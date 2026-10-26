"""HTTP contract tests for the HealthCure FastAPI app."""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import MAX_UPLOAD_BYTES, app
from backend.services.report import DISCLAIMER

PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

HEART_FEATURES = {
    "age": 55,
    "sex": 1,
    "cp": 0,
    "trestbps": 140,
    "chol": 250,
    "fbs": 0,
    "restecg": 1,
    "thalach": 145,
    "exang": 0,
    "oldpeak": 1.2,
    "slope": 1,
    "ca": 0,
    "thal": 2,
}


@pytest.fixture(autouse=True)
def mock_models(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HEALTHCURE_MOCK", "1")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _png_bytes(size: int = 8) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (size, size), color="gray").save(buf, format="PNG")
    return buf.getvalue()


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"


def test_metrics(client: TestClient) -> None:
    response = client.get("/api/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert "image" in payload
    assert "text" in payload
    assert "tabular" in payload
    assert isinstance(payload["image"], dict)


def test_model_card(client: TestClient) -> None:
    response = client.get("/api/model-card")
    assert response.status_code == 200
    payload = response.json()
    assert payload["product"] == "HealthCure"
    assert payload["version"]
    assert payload["last_evaluated"]
    assert len(payload["modalities"]) >= 3
    ids = {item["id"] for item in payload["modalities"]}
    assert {"image", "text", "tabular"} <= ids
    assert payload["modalities"][0]["known_failure_modes"]


def test_image_predict(client: TestClient) -> None:
    response = client.post(
        "/api/image",
        files={"file": ("xray.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["label"] in {"NORMAL", "PNEUMONIA"}
    assert 0.0 <= payload["confidence"] <= 1.0
    assert "gradcam_base64" in payload
    assert "NORMAL" in payload["probs"]


def test_text_predict(client: TestClient) -> None:
    response = client.post("/api/text", json={"text": "fever, cough and chest pain"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["label"]
    assert len(payload["top_3"]) == 3
    assert isinstance(payload["lime_word_weights"], dict)


def test_risk_predict(client: TestClient) -> None:
    response = client.post("/api/risk", json={"dataset": "heart", "features": HEART_FEATURES})
    assert response.status_code == 200
    payload = response.json()
    assert payload["level"] in {"low", "moderate", "high"}
    assert 0.0 <= payload["risk_score"] <= 1.0
    assert payload["shap_contributions"]


def test_report(client: TestClient) -> None:
    response = client.post(
        "/api/report",
        json={
            "text": "fever, cough and chest pain",
            "dataset": "heart",
            "features": HEART_FEATURES,
            "image_base64": PNG_B64,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["agreement"], bool)
    assert payload["disclaimer"] == DISCLAIMER
    assert DISCLAIMER in payload["disclaimer"]
    assert payload["next_step"]
    assert payload["diagnosis"]
    assert payload["image"]["label"]
    assert payload["text"]["label"]
    assert payload["risk"]["level"] in {"low", "moderate", "high"}


def test_text_bad_input_422(client: TestClient) -> None:
    response = client.post("/api/text", json={})
    assert response.status_code == 422


def test_risk_bad_dataset_422(client: TestClient) -> None:
    response = client.post("/api/risk", json={"dataset": "lungs", "features": HEART_FEATURES})
    assert response.status_code == 422


def test_report_bad_input_422(client: TestClient) -> None:
    response = client.post("/api/report", json={"text": "cough"})
    assert response.status_code == 422


def test_image_missing_file_422(client: TestClient) -> None:
    response = client.post("/api/image")
    assert response.status_code == 422


def test_upload_over_10mb_413(client: TestClient) -> None:
    blob = b"0" * (MAX_UPLOAD_BYTES + 1)
    response = client.post(
        "/api/image",
        files={"file": ("huge.jpg", blob, "image/jpeg")},
    )
    assert response.status_code == 413
