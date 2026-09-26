"""Rule-based customer/supplier risk scorecards (Suggest-only)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "").split("+")[0])
    except Exception:
        return None


def score_customer(
    customer: dict[str, Any],
    *,
    orders: list[dict[str, Any]],
    transactions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    name = (customer.get("name") or "").strip().lower()
    cust_orders = [
        o
        for o in orders
        if (o.get("customer_name") or "").strip().lower() == name
        or str(o.get("customer_id") or "") == str(customer.get("id") or "")
    ]
    factors: dict[str, float] = {}
    score = 0.15  # baseline

    last = None
    for o in cust_orders:
        d = _parse_dt(o.get("order_date") or o.get("created_at"))
        if d and (last is None or d > last):
            last = d
    if last is None:
        factors["no_history"] = 0.25
        score += 0.25
    else:
        days = (datetime.utcnow() - last).days
        if days > 90:
            factors["stale"] = 0.3
            score += 0.3
        elif days > 45:
            factors["aging"] = 0.15
            score += 0.15
        else:
            factors["recent"] = -0.05
            score = max(0.0, score - 0.05)

    pending = sum(
        float(o.get("total_amount") or 0)
        for o in cust_orders
        if str(o.get("status") or "").lower() in ("pending", "processing", "open")
    )
    spend = sum(float(o.get("total_amount") or 0) for o in cust_orders)
    if pending > 0 and spend > 0 and pending / spend > 0.4:
        factors["pending_ratio"] = 0.25
        score += 0.25
    elif pending > 5000:
        factors["pending_dollars"] = 0.2
        score += 0.2

    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_n = sum(
        1
        for o in cust_orders
        if (d := _parse_dt(o.get("order_date") or o.get("created_at"))) and d >= week_ago
    )
    if recent_n >= 8:
        factors["velocity"] = 0.2
        score += 0.2

    score = float(min(1.0, max(0.0, score)))
    band = "high" if score >= 0.65 else "medium" if score >= 0.4 else "low"
    bits = [f"{k}={v:+.2f}" for k, v in factors.items()]
    return {
        "partner_type": "customer",
        "partner_id": str(customer.get("id") or ""),
        "score": score,
        "band": band,
        "explanation": f"Customer risk {band} ({score:.0%}): " + (", ".join(bits) or "baseline"),
        "factors": factors,
    }


def score_supplier(
    supplier: dict[str, Any],
    *,
    requests: list[dict[str, Any]] | None = None,
    transactions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    requests = requests or []
    transactions = transactions or []
    name = (supplier.get("name") or "").strip().lower()
    factors: dict[str, float] = {}
    score = 0.15

    open_req = [r for r in requests if str(r.get("status") or "").lower() in ("open", "pending", "requested")]
    if len(open_req) >= 3:
        factors["open_requests"] = 0.2
        score += 0.2

    related_tx = [
        t
        for t in transactions
        if (t.get("counterparty") or "").strip().lower() == name
    ]
    last = None
    for t in related_tx:
        d = _parse_dt(t.get("transaction_date") or t.get("created_at"))
        if d and (last is None or d > last):
            last = d
    if related_tx and last and (datetime.utcnow() - last).days > 120:
        factors["stale_pay"] = 0.2
        score += 0.2
    if not related_tx:
        factors["thin_history"] = 0.15
        score += 0.15

    spend = sum(abs(float(t.get("amount") or 0)) for t in related_tx)
    month_spend = float(supplier.get("spend_this_month") or 0)
    if spend > 20000 or month_spend > 10000:
        factors["concentration"] = 0.2
        score += 0.2

    score = float(min(1.0, max(0.0, score)))
    band = "high" if score >= 0.65 else "medium" if score >= 0.4 else "low"
    bits = [f"{k}={v:+.2f}" for k, v in factors.items()]
    return {
        "partner_type": "supplier",
        "partner_id": str(supplier.get("id") or ""),
        "score": score,
        "band": band,
        "explanation": f"Supplier risk {band} ({score:.0%}): " + (", ".join(bits) or "baseline"),
        "factors": factors,
    }


def build_risk_proposal(tenant_id: str, card: dict[str, Any]) -> dict[str, Any]:
    return {
        "business_id": tenant_id,
        "kind": "risk",
        "function_id": "flag_anomalies",
        "entity_type": card["partner_type"],
        "entity_id": card["partner_id"],
        "score": card["score"],
        "unique_top": True,
        "model_version": "risk-rules-v1",
        "explanation": card["explanation"],
        "payload": card,
    }
