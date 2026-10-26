"""Fine-tune DistilBERT on Symptom2Disease with TF-IDF + LogisticRegression baseline.

Run::

    python -m src.text.train [--epochs 4] [--lr 3e-5] [--max-len 128] [--quick]

Artifacts are written under ``models/text/``.
Metrics are written to ``reports/metrics/text.json``.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from src.common.data import load_text
from src.common.paths import PROJECT_ROOT

SEED = 42
DEFAULT_MODEL_NAME = "distilbert-base-uncased"
DEFAULT_MAX_LEN = 128
DEFAULT_LR = 3e-5
DEFAULT_EPOCHS = 4
DEFAULT_BATCH_SIZE = 16

ARTIFACT_ROOT = PROJECT_ROOT / "models" / "text"
METRICS_DIR = PROJECT_ROOT / "reports" / "metrics"
METRICS_PATH = METRICS_DIR / "text.json"


def _set_seeds(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _jsonify(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _jsonify(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonify(v) for v in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return _jsonify(value.tolist())
    if value is pd.NA or (isinstance(value, float) and np.isnan(value)):
        return None
    return value


class SymptomDataset(Dataset):
    """PyTorch Dataset for tokenized symptom text sequences."""

    def __init__(self, encodings: dict[str, torch.Tensor], labels: list[int] | np.ndarray):
        self.encodings = encodings
        self.labels = torch.as_tensor(labels, dtype=torch.long)

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        item = {key: val[idx] for key, val in self.encodings.items()}
        item["labels"] = self.labels[idx]
        return item


def compute_metrics(y_true: list[int] | np.ndarray, y_pred: list[int] | np.ndarray, labels: list[str]) -> dict[str, Any]:
    """Compute overall and per-class classification metrics."""
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    acc = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    macro_p = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    macro_r = float(recall_score(y_true, y_pred, average="macro", zero_division=0))

    precisions = precision_score(y_true, y_pred, average=None, zero_division=0)
    recalls = recall_score(y_true, y_pred, average=None, zero_division=0)
    f1s = f1_score(y_true, y_pred, average=None, zero_division=0)

    per_class: dict[str, dict[str, float | int]] = {}
    for idx, name in enumerate(labels):
        support = int((y_true == idx).sum())
        per_class[name] = {
            "precision": float(precisions[idx]) if idx < len(precisions) else 0.0,
            "recall": float(recalls[idx]) if idx < len(recalls) else 0.0,
            "f1": float(f1s[idx]) if idx < len(f1s) else 0.0,
            "support": support,
        }

    all_indices = list(range(len(labels)))
    cm = confusion_matrix(y_true, y_pred, labels=all_indices).tolist()

    return {
        "accuracy": acc,
        "macro_f1": macro_f1,
        "macro-F1": macro_f1,
        "macro_precision": macro_p,
        "macro_recall": macro_r,
        "per_class": per_class,
        "confusion_matrix": cm,
    }


def fit_baseline(
    train_texts: list[str],
    train_labels: list[int],
    test_texts: list[str],
    test_labels: list[int],
    class_names: list[str],
) -> tuple[Pipeline, dict[str, Any]]:
    """Train and evaluate TF-IDF + Logistic Regression baseline."""
    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=5000,
                    sublinear_tf=True,
                    lowercase=True,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=SEED,
                    solver="lbfgs",
                ),
            ),
        ]
    )
    pipeline.fit(train_texts, train_labels)
    preds = pipeline.predict(test_texts)
    metrics = compute_metrics(test_labels, preds, class_names)
    return pipeline, metrics


def load_hf_model_and_tokenizer(
    model_name: str,
    num_labels: int,
    id2label: dict[int, str],
    label2id: dict[str, int],
) -> tuple[AutoModelForSequenceClassification, AutoTokenizer]:
    """Load pretrained HuggingFace tokenizer and model, preferring local cache."""
    # Attempt local files first to prevent external network calls
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
    except Exception:
        tokenizer = AutoTokenizer.from_pretrained(model_name)

    try:
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=num_labels,
            id2label=id2label,
            label2id=label2id,
            local_files_only=True,
        )
    except Exception:
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=num_labels,
            id2label=id2label,
            label2id=label2id,
        )

    return model, tokenizer


def train_distilbert(
    train_texts: list[str],
    train_labels: list[int],
    val_texts: list[str],
    val_labels: list[int],
    class_names: list[str],
    *,
    model_name: str = DEFAULT_MODEL_NAME,
    max_len: int = DEFAULT_MAX_LEN,
    lr: float = DEFAULT_LR,
    epochs: int = DEFAULT_EPOCHS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    device: torch.device = torch.device("cpu"),
) -> tuple[AutoModelForSequenceClassification, AutoTokenizer, dict[str, Any]]:
    """Fine-tune DistilBERT on symptom classification."""
    id2label = {i: name for i, name in enumerate(class_names)}
    label2id = {name: i for i, name in enumerate(class_names)}

    model, tokenizer = load_hf_model_and_tokenizer(
        model_name,
        num_labels=len(class_names),
        id2label=id2label,
        label2id=label2id,
    )
    model.to(device)

    train_enc = tokenizer(
        list(train_texts),
        truncation=True,
        padding="max_length",
        max_length=max_len,
        return_tensors="pt",
    )
    val_enc = tokenizer(
        list(val_texts),
        truncation=True,
        padding="max_length",
        max_length=max_len,
        return_tensors="pt",
    )

    train_ds = SymptomDataset(train_enc, train_labels)
    val_ds = SymptomDataset(val_enc, val_labels)

    train_loader = DataLoader(
        train_ds,
        batch_size=min(batch_size, len(train_ds)),
        shuffle=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=min(batch_size * 2, len(val_ds)),
        shuffle=False,
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    total_steps = max(1, len(train_loader) * epochs)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_steps)

    best_val_f1 = -1.0
    best_state: dict[str, torch.Tensor] | None = None
    best_epoch = 0
    history: list[dict[str, Any]] = []

    print(f"Training DistilBERT ({epochs} epochs, lr={lr}, max_len={max_len}) on {device}...")
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        n_seen = 0
        t0 = time.time()

        for batch in train_loader:
            b_input_ids = batch["input_ids"].to(device)
            b_mask = batch["attention_mask"].to(device)
            b_labels = batch["labels"].to(device)

            optimizer.zero_grad()
            outputs = model(input_ids=b_input_ids, attention_mask=b_mask, labels=b_labels)
            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()

            bsize = len(b_labels)
            train_loss += float(loss.item()) * bsize
            n_seen += bsize

        # Validation
        model.eval()
        val_loss = 0.0
        val_seen = 0
        val_preds: list[int] = []
        val_targets: list[int] = []

        with torch.no_grad():
            for batch in val_loader:
                b_input_ids = batch["input_ids"].to(device)
                b_mask = batch["attention_mask"].to(device)
                b_labels = batch["labels"].to(device)

                outputs = model(input_ids=b_input_ids, attention_mask=b_mask, labels=b_labels)
                loss = outputs.loss
                bsize = len(b_labels)
                val_loss += float(loss.item()) * bsize
                val_seen += bsize

                preds = torch.argmax(outputs.logits, dim=-1).cpu().numpy()
                val_preds.extend(preds.tolist())
                val_targets.extend(b_labels.cpu().numpy().tolist())

        val_metrics = compute_metrics(val_targets, val_preds, class_names)
        val_macro_f1 = val_metrics["macro_f1"]
        elapsed = time.time() - t0

        avg_train_loss = train_loss / max(n_seen, 1)
        avg_val_loss = val_loss / max(val_seen, 1)

        print(
            f"  Epoch {epoch}/{epochs} ({elapsed:.1f}s): "
            f"train_loss={avg_train_loss:.4f}, val_loss={avg_val_loss:.4f}, "
            f"val_macro_f1={val_macro_f1:.4f}"
        )

        history.append(
            {
                "epoch": epoch,
                "train_loss": avg_train_loss,
                "val_loss": avg_val_loss,
                "val_macro_f1": val_macro_f1,
            }
        )

        if val_macro_f1 >= best_val_f1:
            best_val_f1 = val_macro_f1
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()

    info = {
        "best_epoch": best_epoch,
        "best_val_macro_f1": best_val_f1,
        "history": history,
        "lr": lr,
        "max_len": max_len,
        "epochs": epochs,
    }
    return model, tokenizer, info


def evaluate_distilbert(
    model: AutoModelForSequenceClassification,
    tokenizer: AutoTokenizer,
    test_texts: list[str],
    test_labels: list[int],
    class_names: list[str],
    *,
    max_len: int = DEFAULT_MAX_LEN,
    batch_size: int = DEFAULT_BATCH_SIZE,
    device: torch.device = torch.device("cpu"),
) -> tuple[dict[str, Any], np.ndarray]:
    """Evaluate DistilBERT model on test set."""
    model.eval()
    test_enc = tokenizer(
        list(test_texts),
        truncation=True,
        padding="max_length",
        max_length=max_len,
        return_tensors="pt",
    )
    test_ds = SymptomDataset(test_enc, test_labels)
    test_loader = DataLoader(test_ds, batch_size=min(batch_size * 2, len(test_ds)), shuffle=False)

    all_preds: list[int] = []
    all_probs: list[np.ndarray] = []

    with torch.no_grad():
        for batch in test_loader:
            b_input_ids = batch["input_ids"].to(device)
            b_mask = batch["attention_mask"].to(device)
            outputs = model(input_ids=b_input_ids, attention_mask=b_mask)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
            preds = np.argmax(probs, axis=-1)
            all_preds.extend(preds.tolist())
            all_probs.append(probs)

    probs_arr = np.concatenate(all_probs, axis=0) if all_probs else np.empty((0, len(class_names)))
    metrics = compute_metrics(test_labels, all_preds, class_names)
    return metrics, probs_arr


def save_artifacts(
    model: AutoModelForSequenceClassification,
    tokenizer: AutoTokenizer,
    baseline: Pipeline,
    labels: list[str],
    max_len: int,
    out_dir: Path = ARTIFACT_ROOT,
) -> Path:
    """Save fine-tuned DistilBERT model, tokenizer, baseline pipeline, and metadata."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save Hugging Face artifacts
    model.save_pretrained(out_dir)
    tokenizer.save_pretrained(out_dir)

    # Save bundle containing baseline, labels, and config
    id2label = {i: name for i, name in enumerate(labels)}
    label2id = {name: i for i, name in enumerate(labels)}
    bundle = {
        "baseline": baseline,
        "labels": labels,
        "id2label": id2label,
        "label2id": label2id,
        "max_len": max_len,
    }
    joblib.dump(bundle, out_dir / "bundle.joblib")

    # Also save label_map.json for lightweight access
    (out_dir / "label_map.json").write_text(
        json.dumps({"labels": labels, "id2label": id2label, "label2id": label2id}, indent=2),
        encoding="utf-8",
    )
    return out_dir


def compare_models(distilbert_metrics: dict[str, Any], baseline_metrics: dict[str, Any]) -> dict[str, Any]:
    """Construct comparison summary between fine-tuned DistilBERT and baseline."""
    d_f1 = distilbert_metrics["macro_f1"]
    b_f1 = baseline_metrics["macro_f1"]
    d_acc = distilbert_metrics["accuracy"]
    b_acc = baseline_metrics["accuracy"]

    return {
        "distilbert_macro_f1": d_f1,
        "baseline_macro_f1": b_f1,
        "macro_f1_diff": float(d_f1 - b_f1),
        "distilbert_accuracy": d_acc,
        "baseline_accuracy": b_acc,
        "accuracy_diff": float(d_acc - b_acc),
        "winner": "distilbert" if d_f1 >= b_f1 else "logistic_regression",
    }


def train(
    *,
    epochs: int = DEFAULT_EPOCHS,
    lr: float = DEFAULT_LR,
    max_len: int = DEFAULT_MAX_LEN,
    quick: bool = False,
    device: torch.device | None = None,
) -> dict[str, Any]:
    """Run complete training and evaluation pipeline."""
    _set_seeds(SEED)
    if device is None:
        device = torch.device("cpu")
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))

    print(f"Loading Symptom2Disease dataset...")
    df = load_text()
    labels = sorted(df["label"].unique().tolist())
    label2id = {label: i for i, label in enumerate(labels)}
    df["target"] = df["label"].map(label2id)

    if quick:
        print("Running in --quick mode on CPU (subsampled dataset, 1 epoch)...")
        epochs = 1
        # Stratified sample: 4 train, 1 val, 1 test per class (144 total)
        train_idx, val_idx, test_idx = [], [], []
        for _, group in df.groupby("label"):
            train_idx.extend(group.index[:4])
            val_idx.extend(group.index[4:5])
            test_idx.extend(group.index[5:6])
        df_train = df.loc[train_idx]
        df_val = df.loc[val_idx]
        df_test = df.loc[test_idx]
    else:
        # Full split: 70% train, 15% val, 15% test stratified by label
        train_df, temp_df = train_test_split(
            df, test_size=0.30, stratify=df["target"], random_state=SEED
        )
        val_df, test_df = train_test_split(
            temp_df, test_size=0.50, stratify=temp_df["target"], random_state=SEED
        )
        df_train, df_val, df_test = train_df, val_df, test_df

    train_texts = df_train["text"].tolist()
    train_labels = df_train["target"].tolist()
    val_texts = df_val["text"].tolist()
    val_labels = df_val["target"].tolist()
    test_texts = df_test["text"].tolist()
    test_labels = df_test["target"].tolist()

    print(f"Data splits: train={len(train_texts)}, val={len(val_texts)}, test={len(test_texts)}")

    # 1. Fit TF-IDF + LogisticRegression baseline
    print("Fitting TF-IDF + Logistic Regression baseline...")
    baseline_pipe, baseline_metrics = fit_baseline(
        train_texts, train_labels, test_texts, test_labels, labels
    )
    print(f"  Baseline Macro-F1={baseline_metrics['macro_f1']:.4f}, Accuracy={baseline_metrics['accuracy']:.4f}")

    # 2. Fine-tune DistilBERT
    model, tokenizer, train_info = train_distilbert(
        train_texts,
        train_labels,
        val_texts,
        val_labels,
        labels,
        model_name=DEFAULT_MODEL_NAME,
        max_len=max_len,
        lr=lr,
        epochs=epochs,
        batch_size=DEFAULT_BATCH_SIZE,
        device=device,
    )

    # 3. Evaluate DistilBERT
    print("Evaluating DistilBERT on test set...")
    distilbert_metrics, _ = evaluate_distilbert(
        model,
        tokenizer,
        test_texts,
        test_labels,
        labels,
        max_len=max_len,
        device=device,
    )
    distilbert_metrics.update(train_info)
    print(f"  DistilBERT Macro-F1={distilbert_metrics['macro_f1']:.4f}, Accuracy={distilbert_metrics['accuracy']:.4f}")

    # 4. Compare models
    comparison = compare_models(distilbert_metrics, baseline_metrics)

    # 5. Save artifacts
    print(f"Saving model artifacts to {ARTIFACT_ROOT}...")
    save_artifacts(model, tokenizer, baseline_pipe, labels, max_len, ARTIFACT_ROOT)

    # 6. Save metrics report
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "device": str(device),
        "seed": SEED,
        "model_name": DEFAULT_MODEL_NAME,
        "max_len": max_len,
        "learning_rate": lr,
        "epochs": epochs,
        "quick_mode": quick,
        "n_rows": int(len(df)),
        "n_train": int(len(train_texts)),
        "n_val": int(len(val_texts)),
        "n_test": int(len(test_texts)),
        "labels": labels,
        "models": {
            "logistic_regression": baseline_metrics,
            "distilbert": distilbert_metrics,
        },
        "baseline_comparison": comparison,
        "artifacts": str(ARTIFACT_ROOT),
    }

    METRICS_PATH.write_text(json.dumps(_jsonify(report), indent=2) + "\n", encoding="utf-8")
    if not METRICS_PATH.is_file() or METRICS_PATH.stat().st_size == 0:
        raise RuntimeError(f"Failed to write metrics to {METRICS_PATH}")
    print(f"Wrote metrics report to {METRICS_PATH}")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Train text disease classifier with DistilBERT and TF-IDF baseline.")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS, help="Number of fine-tuning epochs (default: 4)")
    parser.add_argument("--lr", type=float, default=DEFAULT_LR, help="Learning rate (default: 3e-5)")
    parser.add_argument("--max-len", type=int, default=DEFAULT_MAX_LEN, help="Max sequence length (default: 128)")
    parser.add_argument("--quick", action="store_true", help="Quick run on CPU with subsampled data and 1 epoch")
    args = parser.parse_args()

    train(
        epochs=args.epochs,
        lr=args.lr,
        max_len=args.max_len,
        quick=args.quick,
        device=torch.device("cpu"),
    )


if __name__ == "__main__":
    main()
