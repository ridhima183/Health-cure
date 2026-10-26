"""Tabular risk scores via ``src.tabular.explain``, with a mock fallback."""
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from backend.schemas import RiskLevel, RiskPrediction
from backend.services import use_mock

_explain: Callable[..., Any] | None = None
_import_attempted = False

_HEART_DEFAULTS = {
    "age": 54.0,
    "sex": 1.0,
    "cp": 0.0,
    "trestbps": 130.0,
    "chol": 246.0,
    "fbs": 0.0,
    "restecg": 1.0,
    "thalach": 150.0,
    "exang": 0.0,
    "oldpeak": 1.0,
    "slope": 1.0,
    "ca": 0.0,
    "thal": 2.0,
}

_DIABETES_DEFAULTS = {
    "Pregnancies": 2.0,
    "Glucose": 120.0,
    "BloodPressure": 70.0,
    "SkinThickness": 20.0,
    "Insulin": 80.0,
    "BMI": 28.0,
    "DiabetesPedigreeFunction": 0.4,
    "Age": 33.0,
}


def _load_explain() -> Callable[..., Any] | None:
    global _explain, _import_attempted
    if _import_attempted:
        return _explain
    _import_attempted = True
    try:
        from src.tabular.explain import explain_risk

        _explain = explain_risk
    except Exception:
        _explain = None
    return _explain


def _clip_score(score: float) -> float:
    return max(0.0, min(1.0, float(score)))


def _level_from_score(score: float) -> RiskLevel:
    if score < 0.34:
        return "low"
    if score < 0.67:
        return "moderate"
    return "high"


def mock_prediction(dataset: str, features: Mapping[str, float] | None = None) -> RiskPrediction:
    features = dict(features or {})
    defaults = _HEART_DEFAULTS if dataset.strip().lower() == "heart" else _DIABETES_DEFAULTS
    if dataset.strip().lower() == "heart":
        age = float(features.get("age", defaults["age"]))
        chol = float(features.get("chol", defaults["chol"]))
        trestbps = float(features.get("trestbps", defaults["trestbps"]))
        score = _clip_score((age / 90.0) * 0.35 + (chol / 400.0) * 0.35 + (trestbps / 200.0) * 0.30)
        contrib = {
            "age": (age - 50.0) / 100.0,
            "chol": (chol - 200.0) / 400.0,
            "trestbps": (trestbps - 120.0) / 200.0,
        }
    else:
        glucose = float(features.get("Glucose", features.get("glucose", defaults["Glucose"])))
        bmi = float(features.get("BMI", features.get("bmi", defaults["BMI"])))
        age = float(features.get("Age", features.get("age", defaults["Age"])))
        score = _clip_score((glucose / 200.0) * 0.45 + (bmi / 50.0) * 0.30 + (age / 90.0) * 0.25)
        contrib = {
            "Glucose": (glucose - 110.0) / 200.0,
            "BMI": (bmi - 25.0) / 40.0,
            "Age": (age - 40.0) / 80.0,
        }
    ordered = dict(sorted(contrib.items(), key=lambda item: abs(item[1]), reverse=True))
    return RiskPrediction(
        risk_score=score,
        level=_level_from_score(score),
        shap_contributions=ordered,
        mock=True,
    )


def predict(dataset: str, features: Mapping[str, float]) -> RiskPrediction:
    if use_mock():
        return mock_prediction(dataset, features)
    fn = _load_explain()
    if fn is None:
        return mock_prediction(dataset, features)
    try:
        result = fn(dataset, dict(features))
        if isinstance(result, list):
            result = result[0]
        score = _clip_score(result["risk_score"])
        level = str(result.get("level") or _level_from_score(score))
        if level not in {"low", "moderate", "high"}:
            level = _level_from_score(score)
        contrib = {
            str(k): float(v)
            for k, v in dict(result.get("shap_contributions") or {}).items()
        }
        return RiskPrediction(
            risk_score=score,
            level=level,  # type: ignore[arg-type]
            shap_contributions=contrib,
            mock=False,
        )
    except Exception:
        return mock_prediction(dataset, features)
