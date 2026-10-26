"""Content-based discovery of HealthCure datasets.

Set HEALTHCURE_DATA to override the default ``<project-root>/dataset`` root.
The raw dataset is only inspected; this module never modifies it.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[2]
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}


def _resolve_data_root() -> Path:
    override = os.environ.get("HEALTHCURE_DATA")
    if override:
        return Path(override).expanduser().resolve()
    dataset = (PROJECT_ROOT / "dataset").resolve()
    datasets = (PROJECT_ROOT / "datasets").resolve()
    if dataset.is_dir():
        return dataset
    if datasets.is_dir():
        return datasets
    return dataset


DATA_ROOT = _resolve_data_root()


def _walk_files(root: Path) -> Iterable[Path]:
    if not root.exists() or not root.is_dir():
        return ()
    return (p for p in root.rglob("*") if p.is_file())


def _read_csv_header(path: Path) -> list[str]:
    try:
        import pandas as pd
        return [str(c).strip().lower() for c in pd.read_csv(path, nrows=0).columns]
    except Exception:
        return []


def find_xray_dir() -> Path | None:
    """Find the shallowest directory containing train/NORMAL and train/PNEUMONIA."""
    if not DATA_ROOT.is_dir():
        return None
    candidates = []
    for train in DATA_ROOT.rglob("train"):
        if not train.is_dir():
            continue
        names = {p.name.lower() for p in train.iterdir() if p.is_dir()}
        if {"normal", "pneumonia"}.issubset(names):
            candidates.append(train.parent)
    return min(candidates, key=lambda p: (len(p.relative_to(DATA_ROOT).parts), str(p).lower())) if candidates else None


def find_text_csv() -> Path | None:
    """Find a CSV by its label/text columns, not by its filename."""
    candidates = []
    for path in _walk_files(DATA_ROOT):
        if path.suffix.lower() != ".csv":
            continue
        columns = set(_read_csv_header(path))
        if {"label", "text"}.issubset(columns):
            candidates.append(path)
    return min(candidates, key=lambda p: (len(p.relative_to(DATA_ROOT).parts), str(p).lower())) if candidates else None


def find_heart() -> Path | None:
    """Find a Cleveland heart dataset CSV or UCI .data file by content."""
    candidates: list[Path] = []
    for path in _walk_files(DATA_ROOT):
        suffix = path.suffix.lower()
        if suffix == ".csv":
            columns = set(_read_csv_header(path))
            if {"cp", "chol"}.issubset(columns):
                candidates.append(path)
        elif suffix == ".data":
            try:
                with path.open("r", encoding="utf-8", errors="ignore") as f:
                    lines = [line.strip() for line in f if line.strip()][:5]
                if lines and any(len(line.split(",")) >= 14 for line in lines):
                    candidates.append(path)
            except OSError:
                pass
    return min(candidates, key=lambda p: (len(p.relative_to(DATA_ROOT).parts), str(p).lower())) if candidates else None


def find_diabetes_csv() -> Path | None:
    """Find a Pima-style CSV by the Outcome column."""
    candidates = []
    for path in _walk_files(DATA_ROOT):
        if path.suffix.lower() == ".csv" and "outcome" in set(_read_csv_header(path)):
            candidates.append(path)
    return min(candidates, key=lambda p: (len(p.relative_to(DATA_ROOT).parts), str(p).lower())) if candidates else None


def find_diabetes_arff() -> Path | None:
    """Find a Pima-style ARFF when no Outcome CSV is present."""
    named = []
    any_arff = []
    for path in _walk_files(DATA_ROOT):
        if path.suffix.lower() != ".arff":
            continue
        any_arff.append(path)
        if "diabetes" in path.name.lower():
            named.append(path)
    pool = named or any_arff
    return min(pool, key=lambda p: (len(p.relative_to(DATA_ROOT).parts), str(p).lower())) if pool else None


def find_diabetes() -> Path | None:
    return find_diabetes_csv() or find_diabetes_arff()


def _count_images(root: Path | None) -> int:
    if root is None:
        return 0
    return sum(1 for p in _walk_files(root) if p.suffix.lower() in IMAGE_EXTENSIONS)


def _count_rows(path: Path | None) -> int | str:
    if path is None:
        return 0
    try:
        import pandas as pd
        if path.suffix.lower() == ".data":
            with path.open("r", encoding="utf-8", errors="ignore") as f:
                return sum(1 for line in f if line.strip())
        return len(pd.read_csv(path))
    except Exception as exc:
        return f"unavailable ({type(exc).__name__})"


def main() -> None:
    xray = find_xray_dir()
    text_csv = find_text_csv()
    heart = find_heart()
    diabetes = find_diabetes()
    print(f"Dataset root: {DATA_ROOT}")
    print(f"xray:     {xray if xray else 'NOT FOUND'} | images: {_count_images(xray)}")
    print(f"text:     {text_csv if text_csv else 'NOT FOUND'} | rows: {_count_rows(text_csv)}")
    print(f"heart:    {heart if heart else 'NOT FOUND'} | rows: {_count_rows(heart)}")
    print(f"diabetes: {diabetes if diabetes else 'NOT FOUND'} | rows: {_count_rows(diabetes)}")


if __name__ == "__main__":
    main()
