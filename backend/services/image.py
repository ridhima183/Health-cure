"""Chest X-ray predictions via ``src.image.explain``, with a mock fallback."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from backend.schemas import ImagePrediction
from backend.services import use_mock

# 1x1 PNG
_MOCK_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

_predict: Callable[..., Any] | None = None
_import_attempted = False


def _load_predict() -> Callable[..., Any] | None:
    global _predict, _import_attempted
    if _import_attempted:
        return _predict
    _import_attempted = True
    try:
        from src.image.explain import predict_image

        _predict = predict_image
    except Exception:
        _predict = None
    return _predict


def mock_prediction(label: str = "PNEUMONIA") -> ImagePrediction:
    if label.upper() == "NORMAL":
        probs = {"NORMAL": 0.62, "PNEUMONIA": 0.38}
        chosen = "NORMAL"
    else:
        probs = {"NORMAL": 0.18, "PNEUMONIA": 0.82}
        chosen = "PNEUMONIA"
    return ImagePrediction(
        label=chosen,
        confidence=probs[chosen],
        probs=probs,
        gradcam_base64=_MOCK_PNG_B64,
        mock=True,
    )


def predict(image_bytes: bytes) -> ImagePrediction:
    if use_mock():
        return mock_prediction()
    fn = _load_predict()
    if fn is None:
        return mock_prediction()
    try:
        result = fn(image_bytes)
        return ImagePrediction(
            label=str(result["label"]),
            confidence=float(result["confidence"]),
            probs={str(k): float(v) for k, v in dict(result["probs"]).items()},
            gradcam_base64=str(result["gradcam_base64"]),
            mock=False,
        )
    except Exception:
        return mock_prediction()
