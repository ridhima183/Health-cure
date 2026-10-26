"""Pydantic request/response models for the HealthCure HTTP contract."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

DatasetName = Literal["heart", "diabetes"]
RiskLevel = Literal["low", "moderate", "high"]


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "healthcure"


class LabelScore(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)


class ImagePrediction(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    probs: dict[str, float]
    gradcam_base64: str
    mock: bool = False


class TextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    num_samples: int | None = Field(default=None, ge=1, le=200)


class TextPrediction(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    top_3: list[LabelScore]
    lime_word_weights: dict[str, float]
    mock: bool = False


class RiskRequest(BaseModel):
    dataset: DatasetName
    features: dict[str, float]


class RiskPrediction(BaseModel):
    risk_score: float = Field(ge=0.0, le=1.0)
    level: RiskLevel
    shap_contributions: dict[str, float]
    mock: bool = False


class ReportRequest(BaseModel):
    text: str = Field(..., min_length=1)
    dataset: DatasetName
    features: dict[str, float]
    num_samples: int | None = Field(default=None, ge=1, le=200)
    image_base64: str | None = None


class ReportResponse(BaseModel):
    image: ImagePrediction
    text: TextPrediction
    risk: RiskPrediction
    agreement: bool
    diagnosis: str
    next_step: str
    disclaimer: str


class MetricsResponse(BaseModel):
    image: dict[str, Any] = Field(default_factory=dict)
    text: dict[str, Any] = Field(default_factory=dict)
    tabular: dict[str, Any] = Field(default_factory=dict)


class ModelModalityCard(BaseModel):
    id: str
    name: str
    version: str
    architecture: str
    task: str
    training_data: str
    evaluation_set: str
    known_failure_modes: list[str] = Field(default_factory=list)
    intended_use: str = ""
    out_of_scope: list[str] = Field(default_factory=list)


class ModelCardResponse(BaseModel):
    product: str = "HealthCure"
    version: str = "0.1.0"
    last_evaluated: str | None = None
    intended_use: str = ""
    disclaimer: str = ""
    modalities: list[ModelModalityCard] = Field(default_factory=list)
