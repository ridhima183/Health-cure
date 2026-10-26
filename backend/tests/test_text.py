import json
from pathlib import Path
import pytest

from src.common.paths import PROJECT_ROOT
from src.text.explain import MAX_LIME_SAMPLES, predict_text


def test_metrics_json_exists_and_valid():
    metrics_path = PROJECT_ROOT / "reports" / "metrics" / "text.json"
    assert metrics_path.is_file(), f"Expected metrics file at {metrics_path}"

    with metrics_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert "models" in data
    assert "logistic_regression" in data["models"]
    assert "distilbert" in data["models"]
    assert "baseline_comparison" in data

    lr_metrics = data["models"]["logistic_regression"]
    d_metrics = data["models"]["distilbert"]

    assert "macro_f1" in lr_metrics
    assert "per_class" in lr_metrics
    assert "confusion_matrix" in lr_metrics

    assert "macro_f1" in d_metrics
    assert "per_class" in d_metrics
    assert "confusion_matrix" in d_metrics


def test_predict_text_output_structure():
    result = predict_text("fever, cough and chest pain", num_samples=50)

    assert "label" in result
    assert isinstance(result["label"], str)
    assert len(result["label"]) > 0

    assert "confidence" in result
    assert isinstance(result["confidence"], float)
    assert 0.0 <= result["confidence"] <= 1.0

    assert "top-3" in result
    assert "top_3" in result
    top_3 = result["top-3"]
    assert len(top_3) == 3
    assert top_3[0]["confidence"] >= top_3[1]["confidence"] >= top_3[2]["confidence"]

    assert "lime_word_weights" in result
    weights = result["lime_word_weights"]
    assert len(weights) > 0


def test_predict_text_unpacking():
    result = predict_text("fever, cough and chest pain", num_samples=30)
    label, confidence, top_3, weights = result

    assert label == result["label"]
    assert confidence == result["confidence"]
    assert top_3 == result["top-3"]
    assert weights == result["lime_word_weights"]


def test_num_samples_capped_at_200():
    assert MAX_LIME_SAMPLES <= 200
    result = predict_text("headache and blurred vision", num_samples=500)
    assert result["label"]
