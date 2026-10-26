"""Train heart and diabetes baselines plus a PyTorch MLP on CPU.

Run::

    python -m src.tabular.train

Artifacts are written under ``models/tabular/<dataset>/``. Metrics and ROC /
calibration plots go to ``reports/metrics/``.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.calibration import calibration_curve
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from xgboost import XGBClassifier

from src.common.data import PIMA_ZERO_AS_MISSING, load_diabetes, load_heart
from src.common.paths import PROJECT_ROOT

DEVICE = torch.device("cpu")
SEED = 42
ARTIFACT_ROOT = PROJECT_ROOT / "models" / "tabular"
METRICS_DIR = PROJECT_ROOT / "reports" / "metrics"
METRICS_PATH = METRICS_DIR / "tabular.json"

DATASETS = {
    "heart": {
        "loader": load_heart,
        "target": "target",
        "zero_as_missing": (),
    },
    "diabetes": {
        "loader": load_diabetes,
        "target": "Outcome",
        "zero_as_missing": PIMA_ZERO_AS_MISSING,
    },
}


class ZeroAsMissing(BaseEstimator, TransformerMixin):
    """Replace structural zeros with NaN for selected columns (Pima convention)."""

    def __init__(self, columns=None, feature_names=None):
        self.columns = list(columns or [])
        self.feature_names = list(feature_names or [])

    def fit(self, X, y=None):
        if hasattr(X, "columns"):
            self.feature_names_in_ = list(X.columns)
        else:
            self.feature_names_in_ = list(self.feature_names)
        return self

    def transform(self, X):
        names = getattr(self, "feature_names_in_", self.feature_names)
        frame = pd.DataFrame(X, columns=names if names else None)
        for col in self.columns:
            if col not in frame.columns:
                continue
            numeric = pd.to_numeric(frame[col], errors="coerce")
            frame[col] = numeric.mask(numeric == 0, np.nan)
        return frame


class TabularMLP(nn.Module):
    def __init__(self, in_features: int, hidden: tuple[int, ...] = (64, 32), dropout: float = 0.3):
        super().__init__()
        layers: list[nn.Module] = []
        prev = in_features
        for width in hidden:
            layers.extend(
                [
                    nn.Linear(prev, width),
                    nn.BatchNorm1d(width),
                    nn.ReLU(),
                    nn.Dropout(dropout),
                ]
            )
            prev = width
        layers.append(nn.Linear(prev, 1))
        self.net = nn.Sequential(*layers)
        self.in_features = in_features
        self.hidden = tuple(hidden)
        self.dropout = dropout

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def _set_seeds(seed: int = SEED) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)


def _jsonify(value):
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


def make_preprocessor(feature_names: list[str], zero_as_missing: tuple[str, ...]) -> Pipeline:
    return Pipeline(
        [
            ("zero_as_missing", ZeroAsMissing(columns=list(zero_as_missing), feature_names=feature_names)),
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )


def classification_metrics(y_true, y_prob, threshold: float = 0.5) -> dict:
    y_true = np.asarray(y_true).astype(int)
    y_prob = np.asarray(y_prob, dtype=float).reshape(-1)
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    specificity = float(tn / (tn + fp)) if (tn + fp) else 0.0
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "specificity": specificity,
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "average_precision": float(average_precision_score(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
        "log_loss": float(log_loss(y_true, np.clip(y_prob, 1e-6, 1 - 1e-6))),
        "threshold": threshold,
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def _pos_weight(y: np.ndarray) -> float:
    pos = float((y == 1).sum())
    neg = float((y == 0).sum())
    if pos <= 0:
        return 1.0
    return neg / pos


def train_mlp(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    *,
    hidden: tuple[int, ...] = (64, 32),
    dropout: float = 0.3,
    max_epochs: int = 80,
    patience: int = 12,
    batch_size: int = 32,
    lr: float = 1e-3,
) -> tuple[TabularMLP, dict]:
    model = TabularMLP(in_features=X_train.shape[1], hidden=hidden, dropout=dropout).to(DEVICE)
    train_ds = TensorDataset(
        torch.as_tensor(X_train, dtype=torch.float32),
        torch.as_tensor(y_train, dtype=torch.float32).unsqueeze(1),
    )
    val_x = torch.as_tensor(X_val, dtype=torch.float32, device=DEVICE)
    val_y = np.asarray(y_val).astype(int)
    loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True, drop_last=len(train_ds) > batch_size)
    criterion = nn.BCEWithLogitsLoss(
        pos_weight=torch.tensor([_pos_weight(y_train)], dtype=torch.float32, device=DEVICE)
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    best_state = None
    best_auc = -np.inf
    best_epoch = 0
    wait = 0
    history = []

    for epoch in range(1, max_epochs + 1):
        model.train()
        epoch_loss = 0.0
        n_seen = 0
        for xb, yb in loader:
            xb = xb.to(DEVICE)
            yb = yb.to(DEVICE)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item()) * len(xb)
            n_seen += len(xb)
        model.eval()
        with torch.no_grad():
            val_prob = torch.sigmoid(model(val_x)).cpu().numpy().reshape(-1)
        val_auc = float(roc_auc_score(val_y, val_prob)) if len(np.unique(val_y)) > 1 else 0.0
        history.append({"epoch": epoch, "train_loss": epoch_loss / max(n_seen, 1), "val_auc": val_auc})
        if val_auc > best_auc + 1e-4:
            best_auc = val_auc
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            wait = 0
        else:
            wait += 1
            if wait >= patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model, {
        "best_val_auc": float(best_auc),
        "best_epoch": int(best_epoch),
        "epochs_run": int(history[-1]["epoch"] if history else 0),
        "early_stopping_patience": patience,
        "hidden": list(hidden),
        "dropout": dropout,
        "device": str(DEVICE),
    }


def mlp_predict_proba(model: TabularMLP, X: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        tensor = torch.as_tensor(np.asarray(X, dtype=np.float32), dtype=torch.float32, device=DEVICE)
        return torch.sigmoid(model(tensor)).cpu().numpy().reshape(-1)


def _fit_baselines(X_train: np.ndarray, y_train: np.ndarray) -> dict:
    scale_pos = _pos_weight(y_train)
    models = {
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            solver="lbfgs",
            random_state=SEED,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=SEED,
            n_jobs=-1,
        ),
        "xgboost": XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            n_jobs=-1,
            random_state=SEED,
            scale_pos_weight=scale_pos,
            tree_method="hist",
            verbosity=0,
        ),
    }
    fitted = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        fitted[name] = model
    return fitted


def _predict_sklearn(model, X: np.ndarray) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        return np.asarray(model.predict_proba(X)[:, 1], dtype=float)
    if hasattr(model, "decision_function"):
        scores = np.asarray(model.decision_function(X), dtype=float)
        return 1.0 / (1.0 + np.exp(-scores))
    return np.asarray(model.predict(X), dtype=float)


def plot_roc(y_true, curves: dict[str, np.ndarray], title: str, path: Path) -> Path:
    fig, ax = plt.subplots(figsize=(7, 6))
    for name, prob in curves.items():
        fpr, tpr, _ = roc_curve(y_true, prob)
        auc = roc_auc_score(y_true, prob)
        ax.plot(fpr, tpr, label=f"{name} (AUC={auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="chance")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title(title)
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_calibration(y_true, curves: dict[str, np.ndarray], title: str, path: Path) -> Path:
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="perfect")
    n_bins = min(8, max(3, len(np.unique(y_true)) + 2))
    for name, prob in curves.items():
        try:
            frac, mean_pred = calibration_curve(y_true, prob, n_bins=n_bins, strategy="quantile")
        except ValueError:
            frac, mean_pred = calibration_curve(y_true, prob, n_bins=min(5, n_bins), strategy="uniform")
        ax.plot(mean_pred, frac, marker="o", label=name)
    ax.set_xlabel("Predicted probability")
    ax.set_ylabel("Observed frequency")
    ax.set_title(title)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.legend(loc="upper left", fontsize=8)
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return path


def artifact_dir(dataset: str) -> Path:
    path = ARTIFACT_ROOT / dataset
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_artifacts(
    dataset: str,
    *,
    preprocessor: Pipeline,
    baselines: dict,
    mlp: TabularMLP,
    mlp_info: dict,
    feature_names: list[str],
    target: str,
    zero_as_missing: tuple[str, ...],
    background: np.ndarray,
) -> Path:
    out = artifact_dir(dataset)
    joblib.dump(
        {
            "preprocessor": preprocessor,
            "baselines": baselines,
            "feature_names": feature_names,
            "target": target,
            "zero_as_missing": list(zero_as_missing),
            "mlp_info": mlp_info,
        },
        out / "bundle.joblib",
    )
    torch.save(
        {
            "state_dict": mlp.state_dict(),
            "in_features": mlp.in_features,
            "hidden": list(mlp.hidden),
            "dropout": mlp.dropout,
        },
        out / "mlp.pt",
    )
    np.save(out / "background.npy", np.asarray(background, dtype=np.float32))
    return out


def train_dataset(name: str) -> dict:
    spec = DATASETS[name]
    df = spec["loader"]()
    target = spec["target"]
    feature_names = [c for c in df.columns if c != target]
    X = df[feature_names]
    y = df[target].astype(int).to_numpy()

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=SEED
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=SEED
    )

    preprocessor = make_preprocessor(feature_names, spec["zero_as_missing"])
    preprocessor.fit(X_train)
    Xtr = preprocessor.transform(X_train)
    Xva = preprocessor.transform(X_val)
    Xte = preprocessor.transform(X_test)

    baselines = _fit_baselines(Xtr, y_train)
    mlp, mlp_info = train_mlp(Xtr, y_train, Xva, y_val)

    probs = {name: _predict_sklearn(model, Xte) for name, model in baselines.items()}
    probs["mlp"] = mlp_predict_proba(mlp, Xte)

    metrics = {model_name: classification_metrics(y_test, p) for model_name, p in probs.items()}
    metrics["mlp"].update(mlp_info)

    roc_path = METRICS_DIR / f"{name}_roc.png"
    cal_path = METRICS_DIR / f"{name}_calibration.png"
    plot_roc(y_test, probs, f"{name} ROC (test)", roc_path)
    plot_calibration(y_test, probs, f"{name} calibration (test)", cal_path)

    rng = np.random.default_rng(SEED)
    n_bg = min(32, len(X_train))
    bg_idx = rng.choice(len(X_train), size=n_bg, replace=False)
    background = X_train.iloc[list(bg_idx)].to_numpy(dtype=np.float32)

    save_artifacts(
        name,
        preprocessor=preprocessor,
        baselines=baselines,
        mlp=mlp,
        mlp_info=mlp_info,
        feature_names=feature_names,
        target=target,
        zero_as_missing=spec["zero_as_missing"],
        background=background,
    )

    return {
        "n_rows": int(len(df)),
        "n_train": int(len(X_train)),
        "n_val": int(len(X_val)),
        "n_test": int(len(X_test)),
        "feature_names": feature_names,
        "target": target,
        "models": metrics,
        "plots": {
            "roc": str(roc_path),
            "calibration": str(cal_path),
        },
        "artifacts": str(artifact_dir(name)),
        "device": str(DEVICE),
    }


def main() -> None:
    _set_seeds()
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"device": str(DEVICE), "seed": SEED, "datasets": {}}
    for name in DATASETS:
        print(f"Training tabular models for {name} on {DEVICE}...")
        payload["datasets"][name] = train_dataset(name)
        mlp_auc = payload["datasets"][name]["models"]["mlp"]["roc_auc"]
        print(f"  {name} MLP test ROC-AUC={mlp_auc:.3f}")
    METRICS_PATH.write_text(json.dumps(_jsonify(payload), indent=2) + "\n", encoding="utf-8")
    if not METRICS_PATH.is_file() or METRICS_PATH.stat().st_size == 0:
        raise RuntimeError(f"Failed to write metrics: {METRICS_PATH}")
    for name in DATASETS:
        for kind in ("roc", "calibration"):
            path = METRICS_DIR / f"{name}_{kind}.png"
            if not path.is_file() or path.stat().st_size == 0:
                raise RuntimeError(f"Missing plot: {path}")
    print(f"Wrote {METRICS_PATH}")


if __name__ == "__main__":
    # Re-import under the package name so sklearn objects pickle as
    # ``src.tabular.train.ZeroAsMissing`` rather than ``__main__.ZeroAsMissing``.
    from src.tabular.train import main as _package_main

    _package_main()
