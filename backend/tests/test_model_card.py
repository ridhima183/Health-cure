from backend.services.model_card import get_model_card


def test_model_card_includes_version_training_data_and_failure_modes() -> None:
    card = get_model_card()
    assert card.product == "HealthCure"
    assert card.version
    assert card.last_evaluated
    assert len(card.modalities) >= 3
    for modality in card.modalities:
        assert modality.training_data
        assert modality.known_failure_modes
        assert modality.version
