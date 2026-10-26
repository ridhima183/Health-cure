"""Fuse image, text, and risk outputs into a next-step report."""
from __future__ import annotations

from backend.schemas import ImagePrediction, ReportResponse, RiskPrediction, TextPrediction

DISCLAIMER = (
    "HealthCure is an educational decision-support prototype, not a medical device. "
    "Outputs are not a diagnosis, prescription, or treatment plan. "
    "Always consult a qualified clinician before acting on these results."
)

_NEXT_STEP: dict[tuple[str, str], str] = {
    ("pneumonia", "high"): (
        "Seek urgent in-person care. Possible pneumonia plus elevated clinical risk "
        "warrants prompt evaluation of breathing, fever, and cardiovascular status."
    ),
    ("pneumonia", "moderate"): (
        "Arrange a same-week clinical review. Discuss the chest X-ray finding, "
        "symptom pattern, and risk score with a clinician and monitor for worsening breathlessness."
    ),
    ("pneumonia", "low"): (
        "Share the imaging and symptom report with a clinician. Rest, hydrate, and "
        "return promptly if fever, chest pain, or shortness of breath worsens."
    ),
    ("normal", "high"): (
        "The chest image does not suggest pneumonia, but the tabulated risk is high. "
        "Book a clinician visit to review heart or metabolic risk factors."
    ),
    ("normal", "moderate"): (
        "Imaging looks unremarkable for pneumonia. Schedule a routine check to review "
        "moderate heart or diabetes risk and keep tracking symptoms."
    ),
    ("normal", "low"): (
        "No pneumonia pattern on imaging and low tabulated risk. Maintain healthy habits "
        "and mention these results at your next routine visit if symptoms persist."
    ),
    ("diabetes", "high"): (
        "High diabetes-related risk. Contact a clinician soon to review glucose, weight, "
        "and cardiovascular factors; do not change medication without medical advice."
    ),
    ("diabetes", "moderate"): (
        "Moderate diabetes risk. Plan a clinical review of glucose, BMI, and lifestyle, "
        "and keep a symptom diary until then."
    ),
    ("diabetes", "low"): (
        "Low tabulated diabetes risk. Keep nutritious eating and activity habits, and "
        "revisit screening on the schedule your clinician recommends."
    ),
    ("hypertension", "high"): (
        "High cardiovascular risk with a hypertension-related text finding. Seek prompt "
        "clinical assessment of blood pressure and related symptoms."
    ),
    ("hypertension", "moderate"): (
        "Discuss blood-pressure and risk-factor results with a clinician and continue "
        "home monitoring if you already have a cuff."
    ),
    ("hypertension", "low"): (
        "Low tabulated risk. Recheck blood pressure at a routine visit and keep healthy "
        "activity and salt-intake habits."
    ),
}

_DEFAULT_NEXT_STEP = {
    "high": (
        "Elevated risk overall. Contact a clinician promptly to review symptoms, "
        "imaging, and tabulated risk together."
    ),
    "moderate": (
        "Schedule a clinical review of the predicted condition and risk score, and "
        "watch for new or worsening symptoms."
    ),
    "low": (
        "Low tabulated risk. Share this report at a routine visit if symptoms continue, "
        "and seek care sooner if they escalate."
    ),
}


def _norm(label: str) -> str:
    return " ".join(label.strip().lower().replace("_", " ").replace("-", " ").split())


def diagnoses_match(image_label: str, text_label: str) -> bool:
    """Agreement is true when the image and text diagnoses match (normalized)."""
    return _norm(image_label) == _norm(text_label)


def next_step_for(diagnosis: str, level: str) -> str:
    slug = _norm(diagnosis)
    risk = (level or "moderate").strip().lower()
    if risk not in _DEFAULT_NEXT_STEP:
        risk = "moderate"
    if (slug, risk) in _NEXT_STEP:
        return _NEXT_STEP[(slug, risk)]
    for (key, lv), message in _NEXT_STEP.items():
        if lv == risk and (key in slug or slug in key):
            return message
    return _DEFAULT_NEXT_STEP[risk]


def _primary_diagnosis(image: ImagePrediction, text: TextPrediction, agreed: bool) -> str:
    if agreed:
        return text.label
    if _norm(image.label) == "pneumonia":
        return image.label
    return text.label


def build_report(
    image: ImagePrediction,
    text: TextPrediction,
    risk: RiskPrediction,
) -> ReportResponse:
    agreement = diagnoses_match(image.label, text.label)
    diagnosis = _primary_diagnosis(image, text, agreement)
    return ReportResponse(
        image=image,
        text=text,
        risk=risk,
        agreement=agreement,
        diagnosis=diagnosis,
        next_step=next_step_for(diagnosis, risk.level),
        disclaimer=DISCLAIMER,
    )
