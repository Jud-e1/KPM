"""Reconciliation matcher: cold-start rules + optional sklearn ranker."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.features.recon_features import build_pair_features
from app.policy.autonomy import DEFAULT_T_AUTO, DEFAULT_T_SUGGEST, is_unique_top
from app.registry.store import load_artifact


@dataclass
class MatchCandidate:
    order_id: str
    order_number: str
    score: float
    explanation: str
    features: dict[str, float]
    model_version: str


def rule_score(features: dict[str, float]) -> tuple[float, str]:
    """
    Cold-start rules:
    - exact amount (±0.01) + within 1 day + reference substring → ~0.95
    - amount within 1% + ≤2 days + some overlap → ~0.75–0.85
    """
    reasons: list[str] = []
    score = 0.0

    abs_diff = features["abs_amount_diff"]
    days = features["days_apart"]
    ratio = features["amount_ratio"]

    if abs_diff <= 0.01 and days <= 1 and features["ref_exact"] >= 1.0:
        return 0.95, "Exact amount within 1 day and order number appears in the payment reference."

    if abs_diff <= 0.01 and days <= 1:
        score = 0.88
        reasons.append("exact amount within 1 day")
    elif abs_diff <= 0.01 and days <= 3:
        score = 0.78
        reasons.append("exact amount within 3 days")
    elif ratio >= 0.99 and days <= 2:
        score = 0.74
        reasons.append("near-exact amount within 2 days")
    elif ratio >= 0.95 and days <= 5:
        score = 0.62
        reasons.append("close amount within 5 days")
    else:
        score = max(0.0, ratio * 0.45 - min(days, 30) * 0.01)

    if features["ref_exact"] >= 1.0:
        score = min(1.0, score + 0.12)
        reasons.append("order number in reference")
    elif features["ref_token_overlap"] >= 0.3:
        score = min(1.0, score + 0.06)
        reasons.append("reference token overlap")

    if features["name_similarity"] >= 0.4:
        score = min(1.0, score + 0.05)
        reasons.append("counterparty ≈ customer name")

    explanation = "; ".join(reasons) if reasons else "Weak amount/date overlap only."
    return float(min(1.0, max(0.0, score))), explanation


def ranker_score(features: dict[str, float], model: Any) -> float:
    vec = [
        [
            features["abs_amount_diff"],
            features["amount_ratio"],
            features["days_apart"],
            features["ref_exact"],
            features["ref_token_overlap"],
            features["name_similarity"],
        ]
    ]
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(vec)[0]
        # assume positive class last
        return float(proba[-1])
    if hasattr(model, "decision_function"):
        raw = float(model.decision_function(vec)[0])
        # squash roughly to 0–1
        return 1.0 / (1.0 + pow(2.718281828, -raw))
    return rule_score(features)[0]


def score_payment_against_orders(
    tenant_id: str,
    payment: dict[str, Any],
    open_orders: list[dict[str, Any]],
    *,
    confirmed_match_count: int = 0,
) -> list[MatchCandidate]:
    use_ranker = confirmed_match_count >= 50
    artifact = load_artifact(tenant_id, "recon_ranker") if use_ranker else None
    model = artifact[0] if artifact else None
    model_version = (artifact[1].get("version") if artifact else None) or (
        "ranker-v1" if model else "rules-v1"
    )

    candidates: list[MatchCandidate] = []
    for order in open_orders:
        feats = build_pair_features(payment, order).as_dict()
        if model is not None:
            score = ranker_score(feats, model)
            _, rule_expl = rule_score(feats)
            explanation = f"Ranker score {score:.2f} ({rule_expl})"
        else:
            score, explanation = rule_score(feats)
        candidates.append(
            MatchCandidate(
                order_id=str(order["id"]),
                order_number=str(order.get("order_number") or ""),
                score=score,
                explanation=explanation,
                features=feats,
                model_version=model_version,
            )
        )

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


def build_reconcile_proposal(
    tenant_id: str,
    payment: dict[str, Any],
    open_orders: list[dict[str, Any]],
    *,
    confirmed_match_count: int = 0,
) -> dict[str, Any] | None:
    ranked = score_payment_against_orders(
        tenant_id, payment, open_orders, confirmed_match_count=confirmed_match_count
    )
    if not ranked:
        return None
    top = ranked[0]
    second = ranked[1].score if len(ranked) > 1 else None
    unique = is_unique_top(top.score, second)
    if top.score < DEFAULT_T_SUGGEST:
        return None
    return {
        "business_id": tenant_id,
        "kind": "reconcile",
        "function_id": "reconcile",
        "entity_type": "transaction",
        "entity_id": str(payment.get("id") or payment.get("transaction_id")),
        "score": top.score,
        "unique_top": unique,
        "second_score": second,
        "model_version": top.model_version,
        "explanation": (
            f"Likely match to order {top.order_number}: {top.explanation}"
            + (f" (runner-up {second:.2f})" if second is not None else "")
        ),
        "payload": {
            "payment_id": str(payment.get("id") or payment.get("transaction_id")),
            "matched_order_id": top.order_id,
            "order_number": top.order_number,
            "features": top.features,
            "t_suggest": DEFAULT_T_SUGGEST,
            "t_auto": DEFAULT_T_AUTO,
        },
    }
