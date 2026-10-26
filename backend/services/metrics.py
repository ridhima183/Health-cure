"""Load saved evaluation metrics from ``reports/metrics``."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.common.paths import PROJECT_ROOT

from backend.schemas import MetricsResponse

_METRICS_DIR = PROJECT_ROOT / "reports" / "metrics"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def get_metrics() -> MetricsResponse:
    return MetricsResponse(
        image=_read_json(_METRICS_DIR / "image.json"),
        text=_read_json(_METRICS_DIR / "text.json"),
        tabular=_read_json(_METRICS_DIR / "tabular.json"),
    )
