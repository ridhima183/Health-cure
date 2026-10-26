"""Fast risk explanations for trained heart and diabetes tabular models.

``explain_risk(dataset, features)`` returns a risk score in [0, 1], a qualitative
level, and SHAP contributions in original feature space.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd
import shap
import torch

from src.tabular.train import (
    ARTIFACT_ROOT,
    DATASETS,
    DEVICE,
    TabularMLP,
    mlp_predict_proba,
)

RISK_LOW = 0.34
RISK_HIGH = 0.67
_EXPLAINERS: dict[str, Any] = {}


def _artifact_paths(dataset: str) -> dict[str, Path]:
    root = ARTIFACT_ROOT / dataset
    return {
        "root": root,
        "bundle": root / "bundle.joblib",
        "mlp": root / "mlp.pt",
        "background": root / "background.npy",
    }


@lru_cache(maxsize=4)
def load_bundle(dataset: str) -> dict[str, Any]:
    name = dataset.strip().lower()
    if name not in DATASETS:
        raise ValueError(f"dataset must be one of {sorted(DATASETS)}; got {dataset!r}")
    paths = _artifact_paths(name)
    missing = [str(p) for key, p in paths.items() if key != "root" and not p.is_file()]
    if missing:
        raise FileNotFoundError(
            "Trained tabular artifacts missing. Run `python -m src.tabular.train` first. "
            f"Missing: {missing}"
        )
    bundle = joblib.load(paths["bundle"])
    try:
        ckpt = torch.load(paths["mlp"], map_location=DEVICE, weights_only=False)
    except TypeError:
        ckpt = torch.load(paths["mlp"], map_location=DEVICE)
    model = TabularMLP(
        in_features=int(ckpt["in_features"]),
        hidden=tuple(ckpt["hidden"]),
        dropout=float(ckpt["dropout"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.to(DEVICE)
    model.eval()
    background = np.load(paths["background"])
    return {
        "dataset": name,
        "preprocessor": bundle["preprocessor"],
        "feature_names": list(bundle["feature_names"]),
        "target": bundle["target"],
        "mlp": model,
        "background": np.asarray(background, dtype=np.float32),
    }


def features_to_frame(features: Any, feature_names: list[str]) -> pd.DataFrame:
    if isinstance(features, pd.DataFrame):
        frame = features.copy()
    elif isinstance(features, pd.Series):
        frame = features.to_frame().T
    elif isinstance(features, Mapping):
        lookup = {str(k).strip().lower(): v for k, v in features.items()}
        row = {}
        for name in feature_names:
            if name in features:
                row[name] = features[name]
            elif name.lower() in lookup:
                row[name] = lookup[name.lower()]
            else:
                row[name] = np.nan
        frame = pd.DataFrame([row], columns=feature_names)
    else:
        array = np.asarray(features, dtype=float)
        if array.ndim == 1:
            array = array.reshape(1, -1)
        if array.shape[1] != len(feature_names):
            raise ValueError(
                f"Expected {len(feature_names)} features {feature_names}, got shape {array.shape}"
            )
        frame = pd.DataFrame(array, columns=feature_names)
    return frame.reindex(columns=feature_names)


def risk_level(score: float) -> str:
    if score < RISK_LOW:
        return "low"
    if score < RISK_HIGH:
        return "moderate"
    return "high"


def _predict_raw(bundle: dict[str, Any], raw: np.ndarray) -> np.ndarray:
    frame = pd.DataFrame(np.asarray(raw, dtype=float), columns=bundle["feature_names"])
    transformed = bundle["preprocessor"].transform(frame)
    return mlp_predict_proba(bundle["mlp"], transformed)


def _explainer_for(dataset: str):
    if dataset in _EXPLAINERS:
        return _EXPLAINERS[dataset]
    bundle = load_bundle(dataset)
    background = np.asarray(bundle["background"], dtype=float)
    if background.ndim != 2:
        raise ValueError("SHAP background must be a 2D array of raw feature rows")
    masker = shap.maskers.Independent(background, max_samples=min(32, len(background)))
    n_features = len(bundle["feature_names"])
    explainer = shap.Explainer(
        lambda x: _predict_raw(bundle, x),
        masker,
        algorithm="permutation",
        seed=0,
        feature_names=bundle["feature_names"],
    )
    explainer._healthcure_max_evals = 2 * n_features + 1
    _EXPLAINERS[dataset] = explainer
    return explainer


def explain_risk(dataset: str, features: Any) -> dict[str, Any]:
    """Return MLP risk score, level, and SHAP contributions for one (or more) rows.

    Parameters
    ----------
    dataset:
        ``"heart"`` or ``"diabetes"``.
    features:
        A mapping, Series, DataFrame, or ndarray of raw clinical features.
    """
    bundle = load_bundle(dataset)
    frame = features_to_frame(features, bundle["feature_names"])
    transformed = bundle["preprocessor"].transform(frame)
    scores = mlp_predict_proba(bundle["mlp"], transformed)
    explainer = _explainer_for(bundle["dataset"])
    shap_result = explainer(
        frame.to_numpy(dtype=float),
        max_evals=getattr(explainer, "_healthcure_max_evals", 2 * len(bundle["feature_names"]) + 1),
        silent=True,
    )
    values = np.asarray(shap_result.values)
    if values.ndim == 3:
        values = values[:, :, 1] if values.shape[-1] == 2 else values.mean(axis=-1)

    rows = []
    for i, score in enumerate(scores):
        contrib = {
            name: float(values[i, j])
            for j, name in enumerate(bundle["feature_names"])
        }
        ordered = dict(sorted(contrib.items(), key=lambda item: abs(item[1]), reverse=True))
        rows.append(
            {
                "risk_score": float(score),
                "level": risk_level(float(score)),
                "shap_contributions": ordered,
            }
        )
    return rows[0] if len(rows) == 1 else rows


def main() -> None:
    name = "heart"
    bundle = load_bundle(name)
    df = DATASETS[name]["loader"]()
    row = df.drop(columns=[bundle["target"]]).iloc[0]
    result = explain_risk(name, row)
    print(result)


if __name__ == "__main__":
    main()
