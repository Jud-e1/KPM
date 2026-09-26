"""Anomaly rules + IsolationForest path. Auto = flag only (never edit books)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

from app.features.anomaly_features import (
    amount_vs_median_ratio,
    build_if_vector,
    duplicate_fingerprint,
    rolling_amounts,
)
from app.policy.autonomy import DEFAULT_T_SUGGEST
from app.registry.store import load_artifact, save_artifact

IF_MIN_ROWS = 200
MODEL_NAME = "anomaly_if"


@dataclass
class AnomalyHit:
    score: float
    severity: str  # soft | hard
    rule_ids: list[str]
    explanation: str
    model_version: str
    entity_type: str
    entity_id: str


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00").split("+")[0])
    except Exception:
        return None


def run_rules(
    *,
    entity_type: str,
    entity: dict[str, Any],
    sibling_orders: list[dict[str, Any]] | None = None,
    transactions: list[dict[str, Any]] | None = None,
    known_counterparties: set[str] | None = None,
    last_prices: dict[str, float] | None = None,
) -> AnomalyHit | None:
    rules: list[str] = []
    bits: list[str] = []
    score = 0.0
    sibling_orders = sibling_orders or []
    transactions = transactions or []
    known_counterparties = known_counterparties or set()
    last_prices = last_prices or {}

    if entity_type == "order":
        fp = duplicate_fingerprint(entity)
        fps = [duplicate_fingerprint(o) for o in sibling_orders if o.get("id") != entity.get("id")]
        if fps.count(fp) >= 1:
            rules.append("duplicate_fingerprint")
            bits.append("Looks like a duplicate order (same customer, amount, day, item count).")
            score = max(score, 0.86)

        today = (_parse_dt(entity.get("order_date") or entity.get("created_at")) or datetime.utcnow()).date()
        same_day = [
            o
            for o in sibling_orders
            if (_parse_dt(o.get("order_date") or o.get("created_at")) or datetime.utcnow()).date() == today
        ]
        if len(same_day) >= 8:
            rules.append("order_velocity")
            bits.append(f"Unusually high order velocity today ({len(same_day)} orders).")
            score = max(score, 0.72)

        amounts = [abs(float(o.get("total_amount") or 0)) for o in sibling_orders[-60:]]
        ratio = amount_vs_median_ratio(abs(float(entity.get("total_amount") or 0)), amounts)
        if ratio >= 4.0:
            rules.append("amount_vs_median")
            bits.append(f"Order amount is {ratio:.1f}× the recent median.")
            score = max(score, 0.8 if ratio >= 6 else 0.72)

    elif entity_type == "transaction":
        amounts_map = rolling_amounts(transactions, 30)
        ratio = amount_vs_median_ratio(abs(float(entity.get("amount") or 0)), amounts_map.get("all", []))
        if ratio >= 5.0:
            rules.append("amount_vs_median")
            bits.append(f"Transaction is {ratio:.1f}× the 30-day median.")
            score = max(score, 0.82)

        cp = (entity.get("counterparty") or "").strip().lower()
        if cp and known_counterparties and cp not in known_counterparties:
            rules.append("new_counterparty")
            bits.append(f"New counterparty: {entity.get('counterparty')}.")
            score = max(score, 0.7)

    elif entity_type == "product":
        sku = str(entity.get("sku") or "")
        price = float(entity.get("price") or 0)
        prev = last_prices.get(sku)
        if prev and prev > 0 and price > 0:
            jump = abs(price - prev) / prev
            if jump >= 0.4:
                rules.append("price_jump")
                bits.append(f"Price jumped {jump:.0%} vs last known ({prev:.2f} → {price:.2f}).")
                score = max(score, 0.78 if jump >= 0.75 else 0.7)

    if not rules or score < DEFAULT_T_SUGGEST:
        return None

    severity = "hard" if score >= 0.85 else "soft"
    return AnomalyHit(
        score=float(min(1.0, score)),
        severity=severity,
        rule_ids=rules,
        explanation=" ".join(bits),
        model_version="rules-v1",
        entity_type=entity_type,
        entity_id=str(entity.get("id") or ""),
    )


def train_isolation_forest(tenant_id: str, rows: list[list[float]], version: str = "if-v1") -> str:
    if len(rows) < IF_MIN_ROWS:
        raise ValueError(f"Need ≥{IF_MIN_ROWS} rows to train IsolationForest (got {len(rows)})")
    X = np.asarray(rows, dtype=float)
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)
    save_artifact(
        tenant_id,
        MODEL_NAME,
        version,
        model,
        {"n_rows": len(rows), "algorithm": "IsolationForest", "contamination": 0.05},
    )
    return version


def score_isolation_forest(tenant_id: str, vector: list[float]) -> tuple[float, str] | None:
    loaded = load_artifact(tenant_id, MODEL_NAME)
    if not loaded:
        return None
    model, meta = loaded
    # decision_function: higher = more normal; convert to anomaly score 0–1
    raw = float(model.decision_function([vector])[0])
    # map roughly: negative → anomalous
    score = 1.0 / (1.0 + np.exp(raw * 3.0))
    return float(score), str(meta.get("version") or "if-v1")


def detect_anomaly(
    tenant_id: str,
    *,
    entity_type: str,
    entity: dict[str, Any],
    sibling_orders: list[dict[str, Any]] | None = None,
    transactions: list[dict[str, Any]] | None = None,
    known_counterparties: set[str] | None = None,
    last_prices: dict[str, float] | None = None,
    tx_count: int = 0,
    context: dict[str, Any] | None = None,
) -> AnomalyHit | None:
    """Rules always run; IF supplements when tenant has enough history."""
    hit = run_rules(
        entity_type=entity_type,
        entity=entity,
        sibling_orders=sibling_orders,
        transactions=transactions,
        known_counterparties=known_counterparties,
        last_prices=last_prices,
    )

    if tx_count >= IF_MIN_ROWS:
        ctx = context or {}
        vec = build_if_vector(entity, ctx)
        if_result = score_isolation_forest(tenant_id, vec)
        if if_result:
            if_score, version = if_result
            if if_score >= DEFAULT_T_SUGGEST:
                if hit is None or if_score > hit.score:
                    hit = AnomalyHit(
                        score=if_score,
                        severity="hard" if if_score >= 0.85 else "soft",
                        rule_ids=(hit.rule_ids if hit else []) + ["isolation_forest"],
                        explanation=(
                            (hit.explanation + " " if hit else "")
                            + f"IsolationForest anomaly score {if_score:.2f}."
                        ).strip(),
                        model_version=version,
                        entity_type=entity_type,
                        entity_id=str(entity.get("id") or ""),
                    )
                elif hit:
                    hit.rule_ids = list(dict.fromkeys(hit.rule_ids + ["isolation_forest"]))
                    hit.model_version = version

    return hit


def build_anomaly_proposal(tenant_id: str, hit: AnomalyHit) -> dict[str, Any]:
    """Core always treats anomaly Auto as flag-only."""
    return {
        "business_id": tenant_id,
        "kind": "anomaly",
        "function_id": "flag_anomalies",
        "entity_type": hit.entity_type,
        "entity_id": hit.entity_id,
        "score": hit.score,
        "unique_top": True,
        "model_version": hit.model_version,
        "explanation": hit.explanation,
        "payload": {
            "rule_ids": hit.rule_ids,
            "severity": hit.severity,
            "auto_semantics": "flag_only",
        },
    }
