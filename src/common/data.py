"""Clean, consistent DataFrame loaders for HealthCure tabular/text datasets."""
from __future__ import annotations

from pathlib import Path
import pandas as pd

from .paths import find_diabetes, find_heart, find_text_csv

PIMA_ZERO_AS_MISSING = ("Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI")
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

HEART_COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach",
    "exang", "oldpeak", "slope", "ca", "thal", "target",
]


def _clean_numeric_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    df = df.replace(r"^\s*\?\s*$", pd.NA, regex=True)
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(how="all").reset_index(drop=True)
    return df


def load_heart(path: str | Path | None = None) -> pd.DataFrame:
    """Load Cleveland heart data; normalise target to binary (target > 0)."""
    source = Path(path) if path is not None else find_heart()
    if source is None:
        raise FileNotFoundError("Heart dataset not found under HEALTHCURE_DATA")
    if source.suffix.lower() == ".data":
        df = pd.read_csv(source, header=None, names=HEART_COLUMNS, na_values="?")
    else:
        df = pd.read_csv(source, na_values="?")
        df.columns = [str(c).strip().lower() for c in df.columns]
        if "target" not in df.columns:
            for candidate in ("num", "condition", "diagnosis", "heartdisease", "heart_disease"):
                if candidate in df.columns:
                    df = df.rename(columns={candidate: "target"})
                    break
        if "target" not in df.columns and len(df.columns) == 14:
            df.columns = HEART_COLUMNS
    df = _clean_numeric_frame(df)
    if "target" not in df.columns:
        raise ValueError(f"Heart data must contain a target column (or 14 UCI columns); found {list(df.columns)}")
    df = df.dropna(subset=["target"]).copy()
    df["target"] = (df["target"] > 0).astype("int64")
    return df.reset_index(drop=True)


def _load_diabetes_arff(source: Path) -> pd.DataFrame:
    names: list[str] = []
    data_started = False
    rows: list[str] = []
    with source.open("r", encoding="utf-8", errors="ignore") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("%"):
                continue
            lower = line.lower()
            if lower.startswith("@attribute"):
                names.append(line.split()[1].strip().strip("'\""))
                continue
            if lower.startswith("@data"):
                data_started = True
                continue
            if lower.startswith("@"):
                continue
            if data_started:
                rows.append(line)
    if not names or not rows:
        raise ValueError(f"Could not parse diabetes ARFF at {source}")
    df = pd.DataFrame([row.split(",") for row in rows], columns=names)
    df = df.rename(columns={c: ARFF_TO_PIMA[c.lower()] for c in df.columns if c.lower() in ARFF_TO_PIMA})
    if "Outcome" in df.columns:
        outcome = df["Outcome"].astype(str).str.strip().str.lower()
        df["Outcome"] = outcome.replace(
            {
                "tested_positive": "1",
                "tested_negative": "0",
                "positive": "1",
                "negative": "0",
            }
        )
    return df


def load_diabetes(path: str | Path | None = None) -> pd.DataFrame:
    """Load Pima-style diabetes data, retaining Outcome as a binary integer target."""
    source = Path(path) if path is not None else find_diabetes()
    if source is None:
        raise FileNotFoundError("Diabetes CSV/ARFF not found under HEALTHCURE_DATA")
    if source.suffix.lower() == ".arff":
        df = _load_diabetes_arff(source)
    else:
        df = pd.read_csv(source, na_values=["?", "", "NA", "NaN"])
    df.columns = [str(c).strip() for c in df.columns]
    outcome_col = next((c for c in df.columns if c.lower() == "outcome"), None)
    if outcome_col is None:
        raise ValueError("Diabetes CSV must contain an Outcome column")
    if outcome_col != "Outcome":
        df = df.rename(columns={outcome_col: "Outcome"})
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["Outcome"]).copy()
    df["Outcome"] = (df["Outcome"] > 0).astype("int64")
    return df.reset_index(drop=True)


def load_text(path: str | Path | None = None) -> pd.DataFrame:
    """Load Symptom2Disease-style data with canonical, non-empty label/text columns."""
    source = Path(path) if path is not None else find_text_csv()
    if source is None:
        raise FileNotFoundError("Text dataset CSV with label,text columns not found under HEALTHCURE_DATA")
    df = pd.read_csv(source)
    lookup = {str(c).strip().lower(): c for c in df.columns}
    if not {"label", "text"}.issubset(lookup):
        raise ValueError(f"Text CSV requires label and text columns; found {list(df.columns)}")
    df = df.rename(columns={lookup["label"]: "label", lookup["text"]: "text"})[["label", "text"]]
    df["label"] = df["label"].astype("string").str.strip()
    df["text"] = df["text"].astype("string").str.replace(r"\s+", " ", regex=True).str.strip()
    df = df.dropna(subset=["label", "text"])
    df = df[(df["label"] != "") & (df["text"] != "")]
    return df.reset_index(drop=True)
