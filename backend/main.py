"""HealthCure FastAPI application: CORS, ``/api`` prefix, and model-backed routes."""
from __future__ import annotations

import base64

from fastapi import APIRouter, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend import schemas
from backend.services import image as image_svc
from backend.services import metrics as metrics_svc
from backend.services import model_card as model_card_svc
from backend.services import report as report_svc
from backend.services import risk as risk_svc
from backend.services import text as text_svc

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

app = FastAPI(
    title="HealthCure API",
    description="Explainable image, text, and tabular decision-support API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _too_large_response() -> JSONResponse:
    return JSONResponse(status_code=413, content={"detail": "Upload exceeds 10 MB limit."})


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_UPLOAD_BYTES:
                return _too_large_response()
        except ValueError:
            pass
    return await call_next(request)


api = APIRouter(prefix="/api")


def _decode_image_b64(value: str) -> bytes:
    payload = value.strip()
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]
    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid image_base64 payload.") from exc
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload exceeds 10 MB limit.")
    if not raw:
        raise HTTPException(status_code=422, detail="Empty image_base64 payload.")
    return raw


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload exceeds 10 MB limit.")
    if not data:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")
    return data


@api.get("/health", response_model=schemas.HealthResponse)
def health() -> schemas.HealthResponse:
    return schemas.HealthResponse()


@api.get("/metrics", response_model=schemas.MetricsResponse)
def metrics() -> schemas.MetricsResponse:
    return metrics_svc.get_metrics()


@api.get("/model-card", response_model=schemas.ModelCardResponse)
def model_card() -> schemas.ModelCardResponse:
    return model_card_svc.get_model_card()


@api.post("/image", response_model=schemas.ImagePrediction)
async def predict_image(file: UploadFile = File(...)) -> schemas.ImagePrediction:
    data = await _read_upload(file)
    return image_svc.predict(data)


@api.post("/text", response_model=schemas.TextPrediction)
def predict_text(body: schemas.TextRequest) -> schemas.TextPrediction:
    return text_svc.predict(body.text, body.num_samples)


@api.post("/risk", response_model=schemas.RiskPrediction)
def predict_risk(body: schemas.RiskRequest) -> schemas.RiskPrediction:
    return risk_svc.predict(body.dataset, body.features)


@api.post("/report", response_model=schemas.ReportResponse)
def predict_report(body: schemas.ReportRequest) -> schemas.ReportResponse:
    image_bytes = _decode_image_b64(body.image_base64) if body.image_base64 else None
    image_pred = image_svc.predict(image_bytes) if image_bytes else image_svc.mock_prediction()
    text_pred = text_svc.predict(body.text, body.num_samples)
    risk_pred = risk_svc.predict(body.dataset, body.features)
    return report_svc.build_report(image_pred, text_pred, risk_pred)


app.include_router(api)
