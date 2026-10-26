"""Backend service helpers. Models are loaded lazily inside each module."""
from __future__ import annotations

import os

MOCK_ENV_VAR = "HEALTHCURE_MOCK"


def use_mock() -> bool:
    return os.environ.get(MOCK_ENV_VAR, "").strip().lower() in {"1", "true", "yes", "on"}
