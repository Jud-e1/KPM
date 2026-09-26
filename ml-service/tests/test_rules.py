"""Lightweight checks for ML autonomy + recon rules (no DB required)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.policy.autonomy import decide, is_unique_top
from app.services.reconciliation import rule_score
from app.services.anomaly import run_rules


def test_autonomy_off():
    r = decide("off", 0.99, unique=True)
    assert r.decision == "drop"


def test_autonomy_suggest():
    r = decide("suggest", 0.75)
    assert r.decision == "suggest"
    r2 = decide("suggest", 0.5)
    assert r2.decision == "drop"


def test_autonomy_auto_and_flag_only():
    r = decide("automatic", 0.95, unique=True, allow_auto_apply=True)
    assert r.decision == "auto"
    r2 = decide("automatic", 0.95, unique=True, allow_auto_apply=False)
    assert r2.decision == "suggest"


def test_unique_gap():
    assert is_unique_top(0.95, 0.70)
    assert not is_unique_top(0.95, 0.90)


def test_rule_score_exact():
    score, expl = rule_score(
        {
            "abs_amount_diff": 0.0,
            "amount_ratio": 1.0,
            "days_apart": 0.0,
            "ref_exact": 1.0,
            "ref_token_overlap": 0.5,
            "name_similarity": 0.0,
        }
    )
    assert score >= 0.92
    assert "order number" in expl.lower() or "Exact" in expl


def test_anomaly_duplicate():
    order = {
        "id": "o2",
        "customer_name": "Ada",
        "total_amount": 100.0,
        "items_count": 2,
        "order_date": "2026-09-23T10:00:00",
    }
    siblings = [
        {
            "id": "o1",
            "customer_name": "Ada",
            "total_amount": 100.0,
            "items_count": 2,
            "order_date": "2026-09-23T09:00:00",
        }
    ]
    hit = run_rules(entity_type="order", entity=order, sibling_orders=siblings)
    assert hit is not None
    assert "duplicate_fingerprint" in hit.rule_ids


if __name__ == "__main__":
    test_autonomy_off()
    test_autonomy_suggest()
    test_autonomy_auto_and_flag_only()
    test_unique_gap()
    test_rule_score_exact()
    test_anomaly_duplicate()
    print("ok")
