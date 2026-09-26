"""Anomaly feature helpers from orders / transactions / products."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Any


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00").split("+")[0])
    except Exception:
        return None


def duplicate_fingerprint(order: dict[str, Any]) -> str:
    day = (_parse_dt(order.get("order_date") or order.get("created_at")) or datetime.utcnow()).date()
    return "|".join(
        [
            str(order.get("customer_name") or "").strip().lower(),
            f"{float(order.get('total_amount') or 0):.2f}",
            str(day),
            str(int(order.get("items_count") or 0)),
        ]
    )


def amount_vs_median_ratio(amount: float, amounts_30d: list[float]) -> float:
    if not amounts_30d:
        return 1.0
    m = median(amounts_30d)
    if m <= 0:
        return 1.0 if amount == 0 else 10.0
    return abs(amount) / m


def build_if_vector(entity: dict[str, Any], context: dict[str, Any]) -> list[float]:
    """Compact numeric vector for IsolationForest."""
    amount = abs(float(entity.get("amount") or entity.get("total_amount") or 0))
    items = float(entity.get("items_count") or 1)
    velocity = float(context.get("orders_today") or 0)
    med_ratio = float(context.get("amount_median_ratio") or 1.0)
    is_new_cp = 1.0 if context.get("new_counterparty") else 0.0
    price_jump = float(context.get("price_jump_ratio") or 1.0)
    return [amount, items, velocity, med_ratio, is_new_cp, price_jump]


def rolling_amounts(transactions: list[dict[str, Any]], days: int = 30) -> dict[str, list[float]]:
    """tenant-local helper: group amounts by day window ending now."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    out: dict[str, list[float]] = defaultdict(list)
    for tx in transactions:
        dt = _parse_dt(tx.get("transaction_date") or tx.get("created_at"))
        if dt and dt >= cutoff:
            out["all"].append(abs(float(tx.get("amount") or 0)))
    return out
