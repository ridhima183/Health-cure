"""Static model-card narrative plus last-evaluated timestamps from metrics files."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.common.paths import PROJECT_ROOT

from backend.schemas import ModelCardResponse, ModelModalityCard

_CARD_PATH = PROJECT_ROOT / "reports" / "model_card.json"
_METRICS_DIR = PROJECT_ROOT / "reports" / "metrics"
_METRIC_FILES = ("image.json", "text.json", "tabular.json")


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _latest_metrics_mtime() -> str | None:
    latest: float | None = None
    for name in _METRIC_FILES:
        path = _METRICS_DIR / name
        if not path.is_file():
            continue
        mtime = path.stat().st_mtime
        if latest is None or mtime > latest:
            latest = mtime
    if latest is None:
        return None
    return datetime.fromtimestamp(latest, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_model_card() -> ModelCardResponse:
    raw = _read_json(_CARD_PATH)
    modalities = [
        ModelModalityCard.model_validate(item)
        for item in raw.get("modalities", [])
        if isinstance(item, dict)
    ]
    return ModelCardResponse(
        product=str(raw.get("product") or "HealthCure"),
        version=str(raw.get("version") or "0.1.0"),
        last_evaluated=_latest_metrics_mtime(),
        intended_use=str(raw.get("intended_use") or ""),
        disclaimer=str(raw.get("disclaimer") or ""),
        modalities=modalities,
    )
