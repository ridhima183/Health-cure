import json
from pathlib import Path
import numpy as np
from PIL import Image
import pytest

from src.common.paths import PROJECT_ROOT, find_xray_dir
from src.image.explain import predict_image


@pytest.fixture(scope="session")
def sample_image_path() -> Path:
    xray_dir = find_xray_dir()
    assert xray_dir is not None and xray_dir.is_dir(), "Chest X-ray dataset directory not found"
    
    # Try finding an image from test/NORMAL or train/NORMAL
    for split in ["test", "val", "train"]:
        for cls in ["NORMAL", "PNEUMONIA"]:
            cls_dir = xray_dir / split / cls
            if cls_dir.is_dir():
                for p in cls_dir.glob("*.*"):
                    if p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
                        return p
    pytest.skip("No valid image file found in dataset directory")


def test_metrics_json_exists_and_valid():
    metrics_path = PROJECT_ROOT / "reports" / "metrics" / "image.json"
    assert metrics_path.is_file(), f"Expected metrics file at {metrics_path}"

    with metrics_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert "models" in data, "Metrics JSON missing 'models' field"
    assert "resnet50" in data["models"], "Missing 'resnet50' model metrics"
    assert "baseline_cnn" in data["models"], "Missing 'baseline_cnn' model metrics"

    for model_name in ["resnet50", "baseline_cnn"]:
        m = data["models"][model_name]
        for metric_name in ["accuracy", "sensitivity", "specificity", "f1", "roc_auc", "confusion_matrix"]:
            assert metric_name in m, f"Model {model_name} missing metric '{metric_name}'"

        cm = m["confusion_matrix"]
        assert isinstance(cm, list) and len(cm) == 2 and len(cm[0]) == 2, f"Invalid confusion matrix format in {model_name}"


def test_predict_image_output_structure(sample_image_path):
    result = predict_image(sample_image_path)

    assert "label" in result
    assert result["label"] in ["NORMAL", "PNEUMONIA"]

    assert "confidence" in result
    assert isinstance(result["confidence"], float)
    assert 0.0 <= result["confidence"] <= 1.0

    assert "probs" in result
    assert "NORMAL" in result["probs"]
    assert "PNEUMONIA" in result["probs"]
    assert pytest.approx(sum(result["probs"].values()), rel=1e-3) == 1.0

    assert "gradcam_base64" in result
    assert isinstance(result["gradcam_base64"], str)
    assert len(result["gradcam_base64"]) > 100


def test_predict_image_unpacking(sample_image_path):
    result = predict_image(sample_image_path)
    label, confidence, probs, gradcam_b64 = result

    assert label == result["label"]
    assert confidence == result["confidence"]
    assert probs == result["probs"]
    assert gradcam_b64 == result["gradcam_base64"]


def test_predict_image_with_bytes(sample_image_path):
    with open(sample_image_path, "rb") as f:
        raw_bytes = f.read()

    result = predict_image(raw_bytes)
    assert result["label"] in ["NORMAL", "PNEUMONIA"]
    assert len(result["gradcam_base64"]) > 100


def test_gradcam_png_std_greater_than_zero():
    figures_dir = PROJECT_ROOT / "reports" / "figures"
    example_png = figures_dir / "gradcam_correct_1.png"
    assert example_png.is_file(), f"Expected Grad-CAM PNG at {example_png}"

    img = np.array(Image.open(example_png))
    pixel_std = float(img.std())
    assert pixel_std > 0, f"Grad-CAM overlay pixel std must be > 0, got {pixel_std}"


def test_roc_and_confusion_plots_exist():
    metrics_dir = PROJECT_ROOT / "reports" / "metrics"
    roc_path = metrics_dir / "image_roc.png"
    cm_path = metrics_dir / "image_confusion.png"

    assert roc_path.is_file(), f"ROC curve PNG missing at {roc_path}"
    assert cm_path.is_file(), f"Confusion matrix PNG missing at {cm_path}"
