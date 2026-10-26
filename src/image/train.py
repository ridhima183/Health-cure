"""Training pipeline for Chest X-Ray Pneumonia detection.

Models:
    1. ResNet50 with ImageNet pretrained weights:
       - Phase 1: Train newly initialized 2-class head.
       - Phase 2: Unfreeze layer4 for fine-tuning.
    2. Small 3-conv Baseline CNN for comparison.

Features:
    - Data augmentations (horizontal flip, small rotation, color jitter, NO vertical flip)
    - 224px input resolution
    - Class-weighted CrossEntropyLoss
    - AdamW optimizer
    - Early stopping on validation recall (pneumonia sensitivity)
    - Mixed precision on CUDA (torch.amp)
    - Test metrics written to reports/metrics/image.json
    - ROC curves and confusion matrix plots written to reports/metrics/
    - 6 Grad-CAM examples (3 correct, 3 wrong) written to reports/figures/

Usage:
    python -m src.image.train [--quick] [--device cpu|cuda]
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import random
import sys
import time
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, Subset
import torchvision.models as models
from torchvision import datasets, transforms

from src.common.paths import PROJECT_ROOT, find_xray_dir

CLASSES = ["NORMAL", "PNEUMONIA"]
IMAGE_SIZE = 224
SEED = 42

MODEL_DIR = PROJECT_ROOT / "models" / "image"
METRICS_DIR = PROJECT_ROOT / "reports" / "metrics"
FIGURES_DIR = PROJECT_ROOT / "reports" / "figures"
METRICS_PATH = METRICS_DIR / "image.json"


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def get_transforms():
    """Return train transform (with augmentations) and eval transform for 224px images."""
    train_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=10),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        # NO vertical flip
        transforms.Lambda(lambda img: img.convert("RGB") if hasattr(img, "convert") else img),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    eval_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.Lambda(lambda img: img.convert("RGB") if hasattr(img, "convert") else img),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    return train_transform, eval_transform


class BaselineCNN(nn.Module):
    """Small 3-convolutional-layer baseline CNN."""

    def __init__(self, num_classes: int = len(CLASSES)):
        super().__init__()
        self.features = nn.Sequential(
            # Conv Block 1: 224 -> 112
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            # Conv Block 2: 112 -> 56
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            # Conv Block 3: 56 -> 28
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(64, 32),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.2),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        return self.classifier(x)


def build_resnet50(num_classes: int = len(CLASSES)) -> nn.Module:
    """Instantiate ResNet50 with ImageNet weights and replace fc head."""
    model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    return model


def compute_class_weights(dataset: Dataset) -> torch.Tensor:
    """Calculate balanced class weights from dataset targets."""
    if hasattr(dataset, "targets"):
        targets = np.array(dataset.targets)
    elif hasattr(dataset, "indices") and hasattr(dataset.dataset, "targets"):
        targets = np.array(dataset.dataset.targets)[dataset.indices]
    else:
        # Fallback: scan samples
        targets = np.array([y for _, y in dataset])

    n_samples = len(targets)
    n_classes = len(CLASSES)
    counts = np.bincount(targets, minlength=n_classes)
    weights = np.zeros(n_classes, dtype=np.float32)
    for c in range(n_classes):
        weights[c] = n_samples / (n_classes * max(counts[c], 1))
    return torch.tensor(weights, dtype=torch.float32)


def evaluate_model(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> tuple[dict[str, Any], np.ndarray, np.ndarray, np.ndarray]:
    """Evaluate model on a dataloader and return comprehensive metrics."""
    model.eval()
    all_targets: list[int] = []
    all_preds: list[int] = []
    all_probs: list[float] = []

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            probs = torch.softmax(outputs, dim=-1)
            preds = torch.argmax(probs, dim=-1)

            all_targets.extend(labels.cpu().numpy().tolist())
            all_preds.extend(preds.cpu().numpy().tolist())
            all_probs.extend(probs[:, 1].cpu().numpy().tolist())

    y_true = np.array(all_targets, dtype=int)
    y_pred = np.array(all_preds, dtype=int)
    y_prob = np.array(all_probs, dtype=float)

    acc = float(accuracy_score(y_true, y_pred))
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    # Sensitivity = Recall of positive class (PNEUMONIA)
    sensitivity = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    # Specificity = Recall of negative class (NORMAL)
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    prec = float(precision_score(y_true, y_pred, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, pos_label=1, zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    try:
        if len(np.unique(y_true)) > 1:
            auc = float(roc_auc_score(y_true, y_prob))
        else:
            auc = 0.5
    except Exception:
        auc = 0.5

    metrics = {
        "accuracy": acc,
        "sensitivity": sensitivity,
        "recall": sensitivity,
        "specificity": specificity,
        "precision": prec,
        "f1": f1,
        "macro_f1": macro_f1,
        "roc_auc": auc,
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "confusion_matrix_dict": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }
    return metrics, y_true, y_pred, y_prob


def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
    use_amp: bool,
    scaler: Any,
) -> float:
    """Run one epoch of training."""
    model.train()
    total_loss = 0.0
    total_samples = 0

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)
        optimizer.zero_grad()

        if use_amp:
            with torch.amp.autocast("cuda"):
                outputs = model(images)
                loss = criterion(outputs, labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

        total_loss += float(loss.item()) * images.size(0)
        total_samples += images.size(0)

    return total_loss / max(total_samples, 1)


def train_resnet50_staged(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    epochs_head: int = 2,
    epochs_full: int = 4,
    lr_head: float = 5e-4,
    lr_layer4: float = 1e-4,
    patience: int = 3,
) -> tuple[nn.Module, dict[str, Any]]:
    """Staged training: 1) Train head with backbone frozen, 2) Unfreeze layer4."""
    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_val_recall = -1.0
    best_weights = copy.deepcopy(model.state_dict())
    patience_counter = 0

    print("--- Phase 1: Training classifier head (backbone frozen) ---")
    for name, param in model.named_parameters():
        param.requires_grad = ("fc" in name)

    opt_head = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=lr_head,
        weight_decay=1e-4,
    )

    for epoch in range(1, epochs_head + 1):
        loss = train_epoch(model, train_loader, criterion, opt_head, device, use_amp, scaler)
        val_metrics, _, _, _ = evaluate_model(model, val_loader, device)
        val_recall = val_metrics["sensitivity"]
        print(f"Head Epoch {epoch}/{epochs_head} - Loss: {loss:.4f} | Val Recall (Sens): {val_recall:.4f} | Val Acc: {val_metrics['accuracy']:.4f}")

        if val_recall > best_val_recall:
            best_val_recall = val_recall
            best_weights = copy.deepcopy(model.state_dict())
            patience_counter = 0
        else:
            patience_counter += 1

    print("--- Phase 2: Unfreezing layer4 and fine-tuning ---")
    for name, param in model.named_parameters():
        param.requires_grad = ("layer4" in name or "fc" in name)

    opt_full = torch.optim.AdamW(
        [
            {"params": [p for n, p in model.named_parameters() if "layer4" in n and p.requires_grad], "lr": lr_layer4},
            {"params": [p for n, p in model.named_parameters() if "fc" in n and p.requires_grad], "lr": lr_head},
        ],
        weight_decay=1e-4,
    )

    for epoch in range(1, epochs_full + 1):
        loss = train_epoch(model, train_loader, criterion, opt_full, device, use_amp, scaler)
        val_metrics, _, _, _ = evaluate_model(model, val_loader, device)
        val_recall = val_metrics["sensitivity"]
        print(f"Fine-tune Epoch {epoch}/{epochs_full} - Loss: {loss:.4f} | Val Recall (Sens): {val_recall:.4f} | Val Acc: {val_metrics['accuracy']:.4f}")

        if val_recall > best_val_recall:
            best_val_recall = val_recall
            best_weights = copy.deepcopy(model.state_dict())
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping triggered on validation recall at epoch {epoch} (patience={patience}).")
                break

    model.load_state_dict(best_weights)
    return model, {"best_val_recall": best_val_recall}


def train_baseline_cnn(
    model: BaselineCNN,
    train_loader: DataLoader,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    epochs: int = 4,
    lr: float = 1e-3,
    patience: int = 3,
) -> BaselineCNN:
    """Train small 3-conv baseline CNN."""
    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    best_val_recall = -1.0
    best_weights = copy.deepcopy(model.state_dict())
    patience_counter = 0

    print("--- Training Baseline 3-Conv CNN ---")
    for epoch in range(1, epochs + 1):
        loss = train_epoch(model, train_loader, criterion, optimizer, device, use_amp, scaler)
        val_metrics, _, _, _ = evaluate_model(model, val_loader, device)
        val_recall = val_metrics["sensitivity"]
        print(f"Baseline Epoch {epoch}/{epochs} - Loss: {loss:.4f} | Val Recall: {val_recall:.4f} | Val Acc: {val_metrics['accuracy']:.4f}")

        if val_recall > best_val_recall:
            best_val_recall = val_recall
            best_weights = copy.deepcopy(model.state_dict())
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping baseline at epoch {epoch}.")
                break

    model.load_state_dict(best_weights)
    return model


def plot_roc_curves(
    y_true: np.ndarray,
    probs_dict: dict[str, np.ndarray],
    output_path: Path,
) -> None:
    """Plot ROC curves for models and save figure."""
    plt.figure(figsize=(8, 6))
    for model_name, probs in probs_dict.items():
        if len(np.unique(y_true)) > 1:
            fpr, tpr, _ = roc_curve(y_true, probs)
            auc = roc_auc_score(y_true, probs)
            plt.plot(fpr, tpr, lw=2, label=f"{model_name} (AUC = {auc:.3f})")
        else:
            plt.plot([0, 1], [0, 1], lw=1, linestyle="--", label=f"{model_name} (single class)")

    plt.plot([0, 1], [0, 1], color="gray", lw=1.5, linestyle="--", label="Chance")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate (1 - Specificity)", fontsize=12)
    plt.ylabel("True Positive Rate (Sensitivity)", fontsize=12)
    plt.title("ROC Curves - Pneumonia Detection", fontsize=14, fontweight="bold")
    plt.legend(loc="lower right", fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=150)
    # Also save xray_roc.png copy
    alt_path = output_path.parent / "xray_roc.png"
    plt.savefig(alt_path, dpi=150)
    plt.close()


def plot_confusion_matrices(
    cms: dict[str, list[list[int]]],
    output_path: Path,
) -> None:
    """Plot side-by-side confusion matrices for evaluated models."""
    n_models = len(cms)
    fig, axes = plt.subplots(1, n_models, figsize=(6 * n_models, 5))
    if n_models == 1:
        axes = [axes]

    for ax, (model_name, cm_list) in zip(axes, cms.items()):
        cm = np.array(cm_list)
        im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        ax.set_title(f"Confusion Matrix: {model_name}", fontsize=13, fontweight="bold")

        tick_marks = np.arange(len(CLASSES))
        ax.set_xticks(tick_marks)
        ax.set_xticklabels(CLASSES, fontsize=11)
        ax.set_yticks(tick_marks)
        ax.set_yticklabels(CLASSES, fontsize=11)

        thresh = cm.max() / 2.0 if cm.max() > 0 else 1.0
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(
                    j, i, format(cm[i, j], "d"),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black",
                    fontsize=14, fontweight="bold",
                )

        ax.set_ylabel("True label", fontsize=11)
        ax.set_xlabel("Predicted label", fontsize=11)

    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=150)
    alt_path = output_path.parent / "xray_confusion.png"
    plt.savefig(alt_path, dpi=150)
    plt.close()


def _make_balanced_subset(dataset: Dataset, n_per_class: int) -> Subset:
    """Create a balanced subset of a dataset given class samples."""
    if hasattr(dataset, "targets"):
        targets = dataset.targets
    elif hasattr(dataset, "samples"):
        targets = [s[1] for s in dataset.samples]
    else:
        targets = [dataset[i][1] for i in range(len(dataset))]

    indices_per_class: dict[int, list[int]] = {0: [], 1: []}
    for idx, y in enumerate(targets):
        if len(indices_per_class[y]) < n_per_class:
            indices_per_class[y].append(idx)
        if all(len(v) >= n_per_class for v in indices_per_class.values()):
            break
    selected_indices = indices_per_class[0] + indices_per_class[1]
    random.shuffle(selected_indices)
    return Subset(dataset, selected_indices)


def run_pipeline(
    quick: bool = False,
    device_name: str | None = None,
    epochs_head: int = 2,
    epochs_full: int = 4,
    epochs_baseline: int = 4,
    batch_size: int = 32,
    lr_head: float = 5e-4,
    lr_layer4: float = 1e-4,
    lr_baseline: float = 1e-3,
    patience: int = 3,
    seed: int = SEED,
) -> dict[str, Any]:
    """Execute end-to-end training and evaluation pipeline."""
    set_seed(seed)

    if device_name is None:
        device = torch.device("cpu" if quick else ("cuda" if torch.cuda.is_available() else "cpu"))
    else:
        device = torch.device(device_name)

    print(f"Running pipeline on device: {device} (quick mode: {quick})")

    # Locate dataset
    xray_root = find_xray_dir()
    if xray_root is None or not xray_root.is_dir():
        raise FileNotFoundError(f"Chest X-Ray dataset directory not found under {PROJECT_ROOT}")

    train_dir = xray_root / "train"
    val_dir = xray_root / "val"
    test_dir = xray_root / "test"

    train_tf, eval_tf = get_transforms()

    raw_train_ds = datasets.ImageFolder(train_dir, transform=train_tf)
    raw_val_ds = datasets.ImageFolder(val_dir, transform=eval_tf)
    raw_test_ds = datasets.ImageFolder(test_dir, transform=eval_tf)

    if quick:
        train_ds = _make_balanced_subset(raw_train_ds, n_per_class=32)  # 64 total
        val_ds = _make_balanced_subset(raw_val_ds, n_per_class=8)      # 16 total
        test_ds = _make_balanced_subset(raw_test_ds, n_per_class=16)   # 32 total
        batch_size = min(batch_size, 16)
        epochs_head = 1
        epochs_full = 1
        epochs_baseline = 1
    else:
        train_ds = raw_train_ds
        val_ds = raw_val_ds
        test_ds = raw_test_ds

    class_weights = compute_class_weights(train_ds).to(device)
    print(f"Class weights (NORMAL: {class_weights[0]:.3f}, PNEUMONIA: {class_weights[1]:.3f})")
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    # 1. Train ResNet50
    print("\n================== 1. ResNet50 Model ==================")
    resnet = build_resnet50(len(CLASSES)).to(device)
    resnet, _ = train_resnet50_staged(
        model=resnet,
        train_loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        device=device,
        epochs_head=epochs_head,
        epochs_full=epochs_full,
        lr_head=lr_head,
        lr_layer4=lr_layer4,
        patience=patience,
    )

    resnet_metrics, y_test, y_pred_res, y_prob_res = evaluate_model(resnet, test_loader, device)
    print("\nResNet50 Test Set Evaluation:")
    for k, v in resnet_metrics.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {resnet_metrics['confusion_matrix']}")

    # 2. Train Baseline CNN
    print("\n================== 2. Baseline CNN Model ==================")
    baseline = BaselineCNN(len(CLASSES)).to(device)
    baseline = train_baseline_cnn(
        model=baseline,
        train_loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        device=device,
        epochs=epochs_baseline,
        lr=lr_baseline,
        patience=patience,
    )

    baseline_metrics, _, y_pred_base, y_prob_base = evaluate_model(baseline, test_loader, device)
    print("\nBaseline CNN Test Set Evaluation:")
    for k, v in baseline_metrics.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {baseline_metrics['confusion_matrix']}")

    # 3. Save checkpoints
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    resnet_path = MODEL_DIR / "resnet50_pneumonia.pt"
    baseline_path = MODEL_DIR / "baseline_cnn.pt"

    torch.save(
        {
            "model_state_dict": resnet.state_dict(),
            "classes": CLASSES,
            "image_size": IMAGE_SIZE,
            "metrics": resnet_metrics,
        },
        resnet_path,
    )
    torch.save(
        {
            "model_state_dict": baseline.state_dict(),
            "classes": CLASSES,
            "image_size": IMAGE_SIZE,
            "metrics": baseline_metrics,
        },
        baseline_path,
    )
    print(f"Saved models to {resnet_path} and {baseline_path}")

    # 4. Generate ROC and Confusion Matrix plots
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    roc_plot_path = METRICS_DIR / "image_roc.png"
    cm_plot_path = METRICS_DIR / "image_confusion.png"

    plot_roc_curves(
        y_true=y_test,
        probs_dict={"ResNet50": y_prob_res, "Baseline CNN": y_prob_base},
        output_path=roc_plot_path,
    )
    plot_confusion_matrices(
        cms={
            "ResNet50": resnet_metrics["confusion_matrix"],
            "Baseline CNN": baseline_metrics["confusion_matrix"],
        },
        output_path=cm_plot_path,
    )
    print(f"Saved plots to {roc_plot_path} and {cm_plot_path}")

    # 5. Compile and save reports/metrics/image.json
    metrics_summary = {
        "device": str(device),
        "quick_mode": quick,
        "seed": seed,
        "image_size": IMAGE_SIZE,
        "classes": CLASSES,
        "n_train": len(train_ds),
        "n_val": len(val_ds),
        "n_test": len(test_ds),
        "class_weights": [float(w) for w in class_weights.cpu().numpy()],
        "models": {
            "resnet50": resnet_metrics,
            "baseline_cnn": baseline_metrics,
        },
        "baseline_comparison": {
            "accuracy_delta": float(resnet_metrics["accuracy"] - baseline_metrics["accuracy"]),
            "sensitivity_delta": float(resnet_metrics["sensitivity"] - baseline_metrics["sensitivity"]),
            "specificity_delta": float(resnet_metrics["specificity"] - baseline_metrics["specificity"]),
            "f1_delta": float(resnet_metrics["f1"] - baseline_metrics["f1"]),
            "roc_auc_delta": float(resnet_metrics["roc_auc"] - baseline_metrics["roc_auc"]),
        },
    }

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"Saved metrics to {METRICS_PATH}")

    # 6. Generate 6 Grad-CAM examples (3 correct, 3 wrong)
    print("\n================== 3. Grad-CAM Explanations ==================")
    from src.image.explain import generate_gradcam_examples

    cam_files = generate_gradcam_examples(
        model=resnet,
        data_dir=xray_root,
        output_dir=FIGURES_DIR,
        num_correct=3,
        num_wrong=3,
        device=device,
    )
    print(f"Saved Grad-CAM examples to {FIGURES_DIR}:")
    print(f"  Correct: {cam_files['correct']}")
    print(f"  Wrong:   {cam_files['wrong']}")

    # Verify that a Grad-CAM PNG has pixel std > 0
    test_cam_path = Path(cam_files["correct"][0])
    cam_img = np.array(Image.open(test_cam_path))
    cam_std = float(cam_img.std())
    print(f"Verified Grad-CAM PNG ({test_cam_path.name}) pixel std: {cam_std:.4f} (> 0: {cam_std > 0})")
    assert cam_std > 0, "Grad-CAM image standard deviation must be > 0"

    return metrics_summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Pneumonia ResNet50 and Baseline CNN.")
    parser.add_argument("--quick", action="store_true", help="Quick mode on small subset for verification.")
    parser.add_argument("--device", type=str, default=None, help="Device to use ('cpu' or 'cuda').")
    parser.add_argument("--epochs-head", type=int, default=2, help="Epochs for training classifier head.")
    parser.add_argument("--epochs-full", type=int, default=4, help="Epochs for fine-tuning layer4 + head.")
    parser.add_argument("--epochs-baseline", type=int, default=4, help="Epochs for baseline CNN.")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size.")
    parser.add_argument("--lr-head", type=float, default=5e-4, help="Head learning rate.")
    parser.add_argument("--lr-layer4", type=float, default=1e-4, help="Layer4 learning rate.")
    parser.add_argument("--lr-baseline", type=float, default=1e-3, help="Baseline CNN learning rate.")
    parser.add_argument("--patience", type=int, default=3, help="Early stopping patience.")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed.")
    args = parser.parse_args()

    run_pipeline(
        quick=args.quick,
        device_name=args.device,
        epochs_head=args.epochs_head,
        epochs_full=args.epochs_full,
        epochs_baseline=args.epochs_baseline,
        batch_size=args.batch_size,
        lr_head=args.lr_head,
        lr_layer4=args.lr_layer4,
        lr_baseline=args.lr_baseline,
        patience=args.patience,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
