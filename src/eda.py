"""Exploratory data analysis for HealthCure image, text, and tabular datasets.

Run end to end with::

    python -m src.eda

Figures are written to ``reports/figures/`` and numeric summaries to
``reports/eda_summary.json``.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if "HEALTHCURE_DATA" not in os.environ:
    _dataset = _PROJECT_ROOT / "dataset"
    _datasets = _PROJECT_ROOT / "datasets"
    if not _dataset.is_dir() and _datasets.is_dir():
        os.environ["HEALTHCURE_DATA"] = str(_datasets.resolve())

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image

from src.common.data import load_diabetes, load_heart, load_text
from src.common.paths import (
    DATA_ROOT,
    IMAGE_EXTENSIONS,
    PROJECT_ROOT,
    find_diabetes_csv,
    find_heart,
    find_text_csv,
    find_xray_dir,
)

REPORTS_DIR = PROJECT_ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
SUMMARY_PATH = REPORTS_DIR / "eda_summary.json"
RNG = np.random.default_rng(42)

XRAY_SPLITS = ("train", "val", "test")
XRAY_CLASSES = ("NORMAL", "PNEUMONIA")
PIMA_ZERO_MISSING = ("Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI")
ARFF_TO_PIMA = {
    "preg": "Pregnancies",
    "plas": "Glucose",
    "pres": "BloodPressure",
    "skin": "SkinThickness",
    "insu": "Insulin",
    "mass": "BMI",
    "pedi": "DiabetesPedigreeFunction",
    "age": "Age",
    "class": "Outcome",
}
HEART_DIST_FEATURES = ("age", "trestbps", "chol", "thalach", "oldpeak")
DIABETES_DIST_FEATURES = (
    "Glucose",
    "BloodPressure",
    "BMI",
    "Age",
    "Pregnancies",
    "DiabetesPedigreeFunction",
)

FIGURE_NAMES = (
    "xray_class_counts.png",
    "xray_sample_grid.png",
    "xray_size_distribution.png",
    "text_label_counts.png",
    "text_length_histogram.png",
    "heart_class_balance.png",
    "diabetes_class_balance.png",
    "missing_values.png",
    "heart_correlation_heatmap.png",
    "diabetes_correlation_heatmap.png",
    "heart_feature_distributions.png",
    "diabetes_feature_distributions.png",
)


def _jsonify(value):
    if isinstance(value, dict):
        return {str(key): _jsonify(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonify(item) for item in value]
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


def _numeric_summary(series: pd.Series) -> dict:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return {"count": 0, "min": None, "max": None, "mean": None, "median": None}
    return {
        "count": int(clean.shape[0]),
        "min": float(clean.min()),
        "max": float(clean.max()),
        "mean": float(clean.mean()),
        "median": float(clean.median()),
    }


def _class_dir_name(folder: Path) -> str | None:
    name = folder.name.upper()
    return name if name in XRAY_CLASSES else None


def _iter_class_images(class_dir: Path) -> list[Path]:
    if not class_dir.is_dir():
        return []
    images = [
        path
        for path in class_dir.iterdir()
        if path.is_file()
        and path.suffix.lower() in IMAGE_EXTENSIONS
        and not path.name.startswith(".")
        and not path.name.startswith("._")
    ]
    return sorted(images)


def collect_xray_inventory(xray_root: Path) -> dict[str, dict[str, list[Path]]]:
    inventory: dict[str, dict[str, list[Path]]] = {}
    for split in XRAY_SPLITS:
        split_dir = xray_root / split
        inventory[split] = {label: [] for label in XRAY_CLASSES}
        if not split_dir.is_dir():
            continue
        for child in split_dir.iterdir():
            label = _class_dir_name(child)
            if label is None:
                continue
            inventory[split][label] = _iter_class_images(child)
    return inventory


def _count_map(inventory: dict[str, dict[str, list[Path]]]) -> dict[str, dict[str, int]]:
    return {
        split: {label: len(paths) for label, paths in classes.items()}
        for split, classes in inventory.items()
    }


def _save_figure(fig: plt.Figure, name: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / name
    fig.tight_layout()
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"Failed to write non-empty figure: {path}")
    return path


def plot_xray_class_counts(counts: dict[str, dict[str, int]]) -> Path:
    labels = list(XRAY_CLASSES)
    x = np.arange(len(XRAY_SPLITS))
    width = 0.35
    fig, ax = plt.subplots(figsize=(8, 5))
    for i, label in enumerate(labels):
        values = [counts[split].get(label, 0) for split in XRAY_SPLITS]
        ax.bar(x + (i - 0.5) * width, values, width, label=label)
    ax.set_xticks(x)
    ax.set_xticklabels(XRAY_SPLITS)
    ax.set_ylabel("Image count")
    ax.set_title("Chest X-ray class counts per split")
    ax.legend()
    return _save_figure(fig, "xray_class_counts.png")


def plot_xray_sample_grid(inventory: dict[str, dict[str, list[Path]]]) -> Path:
    chosen: list[tuple[str, Path]] = []
    for label in XRAY_CLASSES:
        pool = list(inventory.get("train", {}).get(label, []))
        if not pool:
            pool = [path for split in XRAY_SPLITS for path in inventory.get(split, {}).get(label, [])]
        if not pool:
            continue
        n = min(4, len(pool))
        idxs = RNG.choice(len(pool), size=n, replace=False)
        for idx in idxs:
            chosen.append((label, pool[int(idx)]))
    if len(chosen) < 8:
        leftover = [
            (label, path)
            for split in XRAY_SPLITS
            for label, paths in inventory.get(split, {}).items()
            for path in paths
            if (label, path) not in chosen
        ]
        need = 8 - len(chosen)
        if leftover:
            idxs = RNG.choice(len(leftover), size=min(need, len(leftover)), replace=False)
            chosen.extend(leftover[int(i)] for i in np.atleast_1d(idxs))
    if not chosen:
        raise FileNotFoundError("No chest X-ray images found to build the sample grid")
    chosen = chosen[:8]
    cols = 4
    rows = 2
    fig, axes = plt.subplots(rows, cols, figsize=(12, 6))
    axes = np.atleast_1d(axes).ravel()
    for ax, (label, path) in zip(axes, chosen):
        with Image.open(path) as img:
            ax.imshow(img.convert("L"), cmap="gray")
        ax.set_title(f"{label}\n{path.name}", fontsize=8)
        ax.axis("off")
    for ax in axes[len(chosen) :]:
        ax.axis("off")
    fig.suptitle("Chest X-ray sample grid (8 images)")
    return _save_figure(fig, "xray_sample_grid.png")


def collect_image_sizes(inventory: dict[str, dict[str, list[Path]]]) -> pd.DataFrame:
    rows = []
    for split, classes in inventory.items():
        for label, paths in classes.items():
            for path in paths:
                with Image.open(path) as img:
                    width, height = img.size
                rows.append(
                    {
                        "split": split,
                        "label": label,
                        "width": int(width),
                        "height": int(height),
                        "path": str(path),
                    }
                )
    return pd.DataFrame(rows)


def plot_image_size_distribution(sizes: pd.DataFrame) -> Path:
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    if sizes.empty:
        for ax in axes:
            ax.text(0.5, 0.5, "No images", ha="center", va="center")
            ax.set_axis_off()
    else:
        for label, group in sizes.groupby("label"):
            axes[0].scatter(group["width"], group["height"], s=8, alpha=0.45, label=label)
        axes[0].set_xlabel("Width (px)")
        axes[0].set_ylabel("Height (px)")
        axes[0].set_title("Width vs height")
        axes[0].legend()
        axes[1].hist(sizes["width"], bins=30, alpha=0.6, label="width")
        axes[1].hist(sizes["height"], bins=30, alpha=0.6, label="height")
        axes[1].set_xlabel("Pixels")
        axes[1].set_ylabel("Images")
        axes[1].set_title("Size histograms")
        axes[1].legend()
    fig.suptitle("Chest X-ray image-size distribution")
    return _save_figure(fig, "xray_size_distribution.png")


def plot_text_label_counts(label_counts: pd.Series) -> Path:
    ordered = label_counts.sort_values(ascending=True)
    fig, ax = plt.subplots(figsize=(9, max(4, 0.28 * len(ordered))))
    ax.barh(ordered.index.astype(str), ordered.values)
    ax.set_xlabel("Count")
    ax.set_title("Symptom text label counts")
    return _save_figure(fig, "text_label_counts.png")


def plot_text_length_histogram(lengths: pd.Series) -> Path:
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(lengths, bins=40, color="#4C72B0")
    ax.set_xlabel("Text length (characters)")
    ax.set_ylabel("Documents")
    ax.set_title("Symptom text length histogram")
    return _save_figure(fig, "text_length_histogram.png")


def plot_class_balance(counts: pd.Series, title: str, filename: str) -> Path:
    fig, ax = plt.subplots(figsize=(6, 5))
    labels = [str(idx) for idx in counts.index]
    ax.bar(labels, counts.values, color=["#4C72B0", "#DD8452"][: len(counts)])
    ax.set_xlabel("Class")
    ax.set_ylabel("Count")
    ax.set_title(title)
    for i, value in enumerate(counts.values):
        ax.text(i, value, str(int(value)), ha="center", va="bottom")
    return _save_figure(fig, filename)


def plot_missing_values(heart_missing: pd.Series, diabetes_missing: pd.Series) -> Path:
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    axes[0].barh(heart_missing.index.astype(str), heart_missing.values)
    axes[0].set_title("Heart missing values")
    axes[0].set_xlabel("Count")
    axes[1].barh(diabetes_missing.index.astype(str), diabetes_missing.values)
    axes[1].set_title("Diabetes zeros-as-missing (Pima)")
    axes[1].set_xlabel("Count")
    fig.suptitle("Missing values")
    return _save_figure(fig, "missing_values.png")


def plot_correlation_heatmap(df: pd.DataFrame, title: str, filename: str) -> Path:
    numeric = df.select_dtypes(include=[np.number])
    corr = numeric.corr(numeric_only=True)
    fig, ax = plt.subplots(figsize=(9, 7))
    image = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
    ax.set_xticks(range(len(corr.columns)))
    ax.set_yticks(range(len(corr.columns)))
    ax.set_xticklabels(corr.columns, rotation=75, ha="right", fontsize=8)
    ax.set_yticklabels(corr.columns, fontsize=8)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    ax.set_title(title)
    return _save_figure(fig, filename)


def plot_feature_distributions(
    df: pd.DataFrame,
    target: str,
    features: tuple[str, ...],
    title: str,
    filename: str,
) -> Path:
    present = [col for col in features if col in df.columns]
    if not present:
        present = [col for col in df.columns if col != target][:6]
    n = len(present)
    cols = 3
    rows = int(np.ceil(n / cols)) if n else 1
    fig, axes = plt.subplots(rows, cols, figsize=(12, 3.2 * rows))
    axes = np.atleast_1d(axes).ravel()
    grouped = df.groupby(target)
    for ax, col in zip(axes, present):
        for cls, group in grouped:
            ax.hist(group[col].dropna(), bins=20, alpha=0.55, label=str(cls), density=True)
        ax.set_title(col)
        ax.legend(title=target, fontsize=8)
    for ax in axes[len(present) :]:
        ax.axis("off")
    fig.suptitle(title)
    return _save_figure(fig, filename)


def _load_diabetes_arff(path: Path) -> pd.DataFrame:
    names: list[str] = []
    data_started = False
    rows: list[str] = []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("%"):
                continue
            lower = line.lower()
            if lower.startswith("@attribute"):
                token = line.split()[1].strip().strip("'\"")
                names.append(token)
                continue
            if lower.startswith("@data"):
                data_started = True
                continue
            if lower.startswith("@"):
                continue
            if data_started:
                rows.append(line)
    if not names or not rows:
        raise ValueError(f"Could not parse diabetes ARFF at {path}")
    df = pd.DataFrame([row.split(",") for row in rows], columns=names)
    rename = {col: ARFF_TO_PIMA[col.lower()] for col in df.columns if col.lower() in ARFF_TO_PIMA}
    df = df.rename(columns=rename)
    if "Outcome" in df.columns:
        outcome = df["Outcome"].astype(str).str.strip().str.lower()
        mapped = outcome.replace(
            {
                "tested_positive": "1",
                "tested_negative": "0",
                "positive": "1",
                "negative": "0",
            }
        )
        df["Outcome"] = pd.to_numeric(mapped, errors="coerce")
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["Outcome"]).copy()
    df["Outcome"] = (df["Outcome"] > 0).astype("int64")
    return df.reset_index(drop=True)


def load_diabetes_frame() -> tuple[pd.DataFrame, str]:
    csv_path = find_diabetes_csv()
    if csv_path is not None:
        return load_diabetes(csv_path), str(csv_path)
    arff_candidates = sorted(
        path
        for path in DATA_ROOT.rglob("*.arff")
        if path.is_file() and "diabetes" in path.name.lower()
    )
    if not arff_candidates:
        arff_candidates = sorted(path for path in DATA_ROOT.rglob("*.arff") if path.is_file())
    if not arff_candidates:
        raise FileNotFoundError("Diabetes CSV/ARFF not found under HEALTHCURE_DATA")
    source = arff_candidates[0]
    return _load_diabetes_arff(source), str(source)


def _pima_zeros_as_missing(df: pd.DataFrame) -> pd.Series:
    counts = {}
    for col in PIMA_ZERO_MISSING:
        if col not in df.columns:
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        counts[col] = int(((numeric == 0) | numeric.isna()).sum())
    return pd.Series(counts, dtype="int64")


def analyze_xray() -> dict:
    root = find_xray_dir()
    if root is None:
        raise FileNotFoundError("Chest X-ray directory with train/NORMAL and train/PNEUMONIA not found")
    inventory = collect_xray_inventory(root)
    counts = _count_map(inventory)
    sizes = collect_image_sizes(inventory)
    plot_xray_class_counts(counts)
    plot_xray_sample_grid(inventory)
    plot_image_size_distribution(sizes)
    size_stats = {
        "n_images": int(len(sizes)),
        "width": _numeric_summary(sizes["width"]) if not sizes.empty else _numeric_summary(pd.Series(dtype=float)),
        "height": _numeric_summary(sizes["height"]) if not sizes.empty else _numeric_summary(pd.Series(dtype=float)),
        "by_split": {
            split: int((sizes["split"] == split).sum()) if not sizes.empty else 0
            for split in XRAY_SPLITS
        },
    }
    return {
        "root": str(root),
        "class_counts_per_split": counts,
        "image_size": size_stats,
    }


def analyze_text() -> dict:
    source = find_text_csv()
    df = load_text(source)
    label_counts = df["label"].value_counts().sort_index()
    lengths = df["text"].astype(str).str.len()
    plot_text_label_counts(label_counts)
    plot_text_length_histogram(lengths)
    return {
        "source": str(source),
        "n_rows": int(len(df)),
        "n_labels": int(label_counts.shape[0]),
        "label_counts": {str(k): int(v) for k, v in label_counts.items()},
        "text_length_chars": _numeric_summary(lengths),
    }


def analyze_heart() -> tuple[dict, pd.Series]:
    source = find_heart()
    df = load_heart(source)
    balance = df["target"].value_counts().sort_index()
    missing = df.isna().sum().sort_values(ascending=True)
    plot_class_balance(balance, "Heart disease class balance", "heart_class_balance.png")
    plot_correlation_heatmap(df, "Heart feature correlation", "heart_correlation_heatmap.png")
    plot_feature_distributions(
        df,
        "target",
        HEART_DIST_FEATURES,
        "Heart key feature distributions by target",
        "heart_feature_distributions.png",
    )
    summary = {
        "source": str(source),
        "n_rows": int(len(df)),
        "class_balance": {str(k): int(v) for k, v in balance.items()},
        "missing_values": {str(k): int(v) for k, v in missing.items()},
    }
    return summary, missing


def analyze_diabetes() -> tuple[dict, pd.Series]:
    df, source = load_diabetes_frame()
    balance = df["Outcome"].value_counts().sort_index()
    zeros_missing = _pima_zeros_as_missing(df).sort_values(ascending=True)
    raw_missing = df.isna().sum()
    plot_class_balance(balance, "Diabetes class balance", "diabetes_class_balance.png")
    plot_correlation_heatmap(df, "Diabetes feature correlation", "diabetes_correlation_heatmap.png")
    plot_feature_distributions(
        df,
        "Outcome",
        DIABETES_DIST_FEATURES,
        "Diabetes key feature distributions by target",
        "diabetes_feature_distributions.png",
    )
    summary = {
        "source": source,
        "n_rows": int(len(df)),
        "class_balance": {str(k): int(v) for k, v in balance.items()},
        "missing_values": {str(k): int(v) for k, v in raw_missing.items()},
        "zeros_as_missing": {str(k): int(v) for k, v in zeros_missing.items()},
        "pima_zero_as_missing_columns": list(PIMA_ZERO_MISSING),
    }
    return summary, zeros_missing


def write_summary(payload: dict) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(_jsonify(payload), indent=2)
    SUMMARY_PATH.write_text(text + "\n", encoding="utf-8")
    if SUMMARY_PATH.stat().st_size == 0:
        raise RuntimeError(f"Failed to write non-empty summary: {SUMMARY_PATH}")
    return SUMMARY_PATH


def expected_outputs() -> list[Path]:
    return [SUMMARY_PATH, *[FIGURES_DIR / name for name in FIGURE_NAMES]]


def verify_outputs() -> list[str]:
    missing = []
    for path in expected_outputs():
        if not path.is_file() or path.stat().st_size == 0:
            missing.append(str(path))
    if missing:
        raise FileNotFoundError("Missing or empty EDA outputs:\n" + "\n".join(missing))
    return [str(path) for path in expected_outputs()]


def main() -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    xray = analyze_xray()
    text = analyze_text()
    heart, heart_missing = analyze_heart()
    diabetes, diabetes_missing = analyze_diabetes()
    plot_missing_values(heart_missing, diabetes_missing)
    payload = {
        "data_root": str(DATA_ROOT),
        "xray": xray,
        "text": text,
        "heart": heart,
        "diabetes": diabetes,
        "figures": [str(FIGURES_DIR / name) for name in FIGURE_NAMES],
    }
    write_summary(payload)
    outputs = verify_outputs()
    print(f"Wrote {SUMMARY_PATH}")
    for path in outputs:
        size = Path(path).stat().st_size
        print(f"  {path} ({size} bytes)")


if __name__ == "__main__":
    main()
