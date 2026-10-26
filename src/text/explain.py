"""LIME explanations and disease predictions for text symptom inputs.

Usage::

    from src.text.explain import predict_text

    result = predict_text("fever, cough and chest pain")
    print(result)

Or run as a script::

    python -m src.text.explain "fever, cough and chest pain"
"""
from __future__ import annotations

import argparse
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch
from lime.lime_text import LimeTextExplainer
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from src.common.paths import PROJECT_ROOT

ARTIFACT_ROOT = PROJECT_ROOT / "models" / "text"
DEVICE = torch.device("cpu")
MAX_LIME_SAMPLES = 200
DEFAULT_LIME_SAMPLES = 150


class LimeWeights(dict):
    """Dictionary of {word: weight} that also unpacks as (word, weight) tuples."""

    def __init__(self, items: list[tuple[str, float]] | dict[str, float]):
        if isinstance(items, list):
            super().__init__(items)
            self._ordered_items = list(items)
        else:
            super().__init__(items)
            self._ordered_items = list(items.items())

    def __iter__(self):
        # Enables: for word, weight in lime_weights: ...
        return iter(self._ordered_items)

    def as_list(self) -> list[tuple[str, float]]:
        return list(self._ordered_items)


class PredictionResult(dict):
    """Prediction result supporting dict access, attribute access, and 4-tuple unpacking.

    Unpacks as: label, confidence, top_3, lime_word_weights
    """

    def __init__(
        self,
        label: str,
        confidence: float,
        top_3: list[dict[str, Any]],
        lime_word_weights: LimeWeights | list[tuple[str, float]] | dict[str, float],
        **kwargs: Any,
    ):
        weights = lime_word_weights if isinstance(lime_word_weights, LimeWeights) else LimeWeights(lime_word_weights)
        payload = {
            "label": str(label),
            "confidence": float(confidence),
            "top_3": top_3,
            "top-3": top_3,
            "lime_word_weights": weights,
        }
        payload.update(kwargs)
        super().__init__(payload)

    def __getattr__(self, name: str) -> Any:
        if name in self:
            return self[name]
        raise AttributeError(f"'PredictionResult' has no attribute '{name}'")

    def __getitem__(self, item: Any) -> Any:
        if isinstance(item, int):
            # Positional access matching: label, confidence, top_3, lime_word_weights
            elements = [self["label"], self["confidence"], self["top-3"], self["lime_word_weights"]]
            return elements[item]
        return super().__getitem__(item)

    def __iter__(self):
        # Enables tuple unpacking: label, conf, top3, weights = predict_text(...)
        return iter([self["label"], self["confidence"], self["top-3"], self["lime_word_weights"]])

    def to_tuple(self) -> tuple[str, float, list[dict[str, Any]], LimeWeights]:
        return (self["label"], self["confidence"], self["top-3"], self["lime_word_weights"])


@lru_cache(maxsize=1)
def load_text_bundle(model_dir: Path | str | None = None) -> dict[str, Any]:
    """Load model, tokenizer, and labels from artifact directory."""
    root = Path(model_dir) if model_dir is not None else ARTIFACT_ROOT
    bundle_path = root / "bundle.joblib"
    config_path = root / "config.json"

    if not root.is_dir() or not bundle_path.is_file() or not config_path.is_file():
        raise FileNotFoundError(
            f"Trained text artifacts missing at {root}. "
            "Please run `python -m src.text.train` (or with `--quick`) first."
        )

    bundle = joblib.load(bundle_path)
    labels = list(bundle["labels"])
    id2label = {int(k): str(v) for k, v in bundle.get("id2label", {i: l for i, l in enumerate(labels)}).items()}
    max_len = int(bundle.get("max_len", 128))

    tokenizer = AutoTokenizer.from_pretrained(root, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(root, local_files_only=True)
    model.to(DEVICE)
    model.eval()

    class_names = [id2label[i] for i in range(len(id2label))]
    explainer = LimeTextExplainer(class_names=class_names)

    return {
        "model": model,
        "tokenizer": tokenizer,
        "labels": labels,
        "id2label": id2label,
        "class_names": class_names,
        "max_len": max_len,
        "explainer": explainer,
    }


def _predict_probabilities(texts: list[str], bundle: dict[str, Any], batch_size: int = 32) -> np.ndarray:
    """Run batch inference on a list of texts and return softmax probabilities."""
    model = bundle["model"]
    tokenizer = bundle["tokenizer"]
    max_len = bundle["max_len"]

    all_probs: list[np.ndarray] = []
    texts = [str(t) if str(t).strip() else " " for t in texts]

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        inputs = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=max_len,
            return_tensors="pt",
        ).to(DEVICE)

        inputs = {k: v for k, v in inputs.items() if k != "token_type_ids"}
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()
            all_probs.append(probs)

    return np.concatenate(all_probs, axis=0) if all_probs else np.empty((0, len(bundle["labels"])))


def predict_text(text: str, num_samples: int = DEFAULT_LIME_SAMPLES) -> PredictionResult:
    """Predict disease label, confidence, top-3 candidates, and LIME word weights.

    Parameters
    ----------
    text:
        Input symptom description string.
    num_samples:
        Number of perturbation samples for LIME (clamped to at most 200).

    Returns
    -------
    PredictionResult
        Result containing label, confidence, top_3 / top-3, and lime_word_weights.
    """
    if not isinstance(text, str) or not text.strip():
        text = "unspecified symptoms"

    # Enforce num_samples <= 200 requirement
    num_samples = min(int(num_samples), MAX_LIME_SAMPLES)
    if num_samples < 10:
        num_samples = 10

    bundle = load_text_bundle()
    class_names = bundle["class_names"]

    # 1. Forward pass on the single input text
    probs = _predict_probabilities([text], bundle, batch_size=1)[0]
    pred_idx = int(np.argmax(probs))
    pred_label = class_names[pred_idx]
    pred_conf = float(probs[pred_idx])

    # 2. Extract top-3 predictions
    top_indices = np.argsort(probs)[::-1][:3]
    top_3 = [
        {"label": class_names[int(idx)], "confidence": float(probs[int(idx)])}
        for idx in top_indices
    ]

    # 3. Generate LIME word weights for the predicted class
    explainer: LimeTextExplainer = bundle["explainer"]

    def _lime_predict_fn(batch_texts: list[str]) -> np.ndarray:
        return _predict_probabilities(batch_texts, bundle, batch_size=32)

    exp = explainer.explain_instance(
        text,
        _lime_predict_fn,
        labels=[pred_idx],
        num_samples=num_samples,
    )

    raw_weights = exp.as_list(label=pred_idx)
    ordered_weights = [(str(w), float(wt)) for w, wt in raw_weights]
    lime_weights = LimeWeights(ordered_weights)

    return PredictionResult(
        label=pred_label,
        confidence=pred_conf,
        top_3=top_3,
        lime_word_weights=lime_weights,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict disease and explain with LIME.")
    parser.add_argument(
        "text",
        nargs="?",
        default="fever, cough and chest pain",
        help="Symptom text description (default: 'fever, cough and chest pain')",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=DEFAULT_LIME_SAMPLES,
        help="Number of LIME samples (default: 150, max: 200)",
    )
    args = parser.parse_args()

    result = predict_text(args.text, num_samples=args.num_samples)

    # Print summary
    print(f"Predicted Disease: {result['label']}")
    print(f"Confidence:        {result['confidence']:.4f}")
    print("Top-3 Candidates:")
    for rank, item in enumerate(result["top-3"], 1):
        print(f"  {rank}. {item['label']:<32} {item['confidence']:.4f}")
    print("LIME Word Weights:")
    for word, weight in result["lime_word_weights"].items():
        bar = "+" if weight >= 0 else "-"
        print(f"  {bar} {word:<16} {weight:+.4f}")


if __name__ == "__main__":
    main()
