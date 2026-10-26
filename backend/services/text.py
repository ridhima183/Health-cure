"""Symptom-text predictions via ``src.text.explain``, with a mock fallback."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from backend.schemas import LabelScore, TextPrediction
from backend.services import use_mock

_predict: Callable[..., Any] | None = None
_import_attempted = False


def _load_predict() -> Callable[..., Any] | None:
    global _predict, _import_attempted
    if _import_attempted:
        return _predict
    _import_attempted = True
    try:
        from src.text.explain import predict_text

        _predict = predict_text
    except Exception:
        _predict = None
    return _predict


def mock_prediction(text: str = "") -> TextPrediction:
    lowered = text.lower()
    if "fever" in lowered or "cough" in lowered or "chest" in lowered or "pneumonia" in lowered:
        label = "Pneumonia"
        top = [
            LabelScore(label="Pneumonia", confidence=0.74),
            LabelScore(label="Common Cold", confidence=0.16),
            LabelScore(label="Bronchial Asthma", confidence=0.10),
        ]
        weights = {"fever": 0.31, "cough": 0.28, "chest": 0.22}
    elif "thirst" in lowered or "glucose" in lowered or "diabetes" in lowered:
        label = "diabetes"
        top = [
            LabelScore(label="diabetes", confidence=0.71),
            LabelScore(label="Hypertension", confidence=0.18),
            LabelScore(label="Jaundice", confidence=0.11),
        ]
        weights = {"thirst": 0.24, "fatigue": 0.19}
    else:
        label = "Pneumonia"
        top = [
            LabelScore(label="Pneumonia", confidence=0.55),
            LabelScore(label="Migraine", confidence=0.25),
            LabelScore(label="Common Cold", confidence=0.20),
        ]
        weights = {"symptoms": 0.12}
    return TextPrediction(
        label=label,
        confidence=top[0].confidence,
        top_3=top,
        lime_word_weights=weights,
        mock=True,
    )


def _weights_to_dict(raw: Any) -> dict[str, float]:
    if raw is None:
        return {}
    if hasattr(raw, "items"):
        return {str(k): float(v) for k, v in raw.items()}
    if isinstance(raw, list):
        return {str(k): float(v) for k, v in raw}
    return {str(k): float(v) for k, v in dict(raw).items()}


def predict(text: str, num_samples: int | None = None) -> TextPrediction:
    if use_mock():
        return mock_prediction(text)
    fn = _load_predict()
    if fn is None:
        return mock_prediction(text)
    try:
        kwargs: dict[str, Any] = {}
        if num_samples is not None:
            kwargs["num_samples"] = num_samples
        result = fn(text, **kwargs)
        top_raw = result.get("top_3") or result.get("top-3") or []
        top_3 = [
            LabelScore(label=str(item["label"]), confidence=float(item["confidence"]))
            for item in top_raw
        ]
        return TextPrediction(
            label=str(result["label"]),
            confidence=float(result["confidence"]),
            top_3=top_3,
            lime_word_weights=_weights_to_dict(result.get("lime_word_weights")),
            mock=False,
        )
    except Exception:
        return mock_prediction(text)
