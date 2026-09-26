"""Unit tests for shared autonomy policy."""

from app.core.autonomy import decide, is_unique_top


def test_decide_off_drops():
    assert decide("off", 0.99).decision == "drop"


def test_decide_suggest_thresholds():
    assert decide("suggest", 0.70).decision == "suggest"
    assert decide("suggest", 0.69).decision == "drop"


def test_decide_auto_requires_unique():
    assert decide("automatic", 0.95, unique=True).decision == "auto"
    assert decide("automatic", 0.95, unique=False).decision == "suggest"


def test_anomaly_flag_only_never_auto_applies():
    assert decide("automatic", 0.99, allow_auto_apply=False).decision == "suggest"


def test_unique_top_gap():
    assert is_unique_top(0.95, 0.70) is True
    assert is_unique_top(0.95, 0.85) is False
