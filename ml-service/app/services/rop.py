"""Reorder point (ROP) + draft PO proposal builder."""

from __future__ import annotations

import math
from typing import Any

from app.services.forecast import ForecastResult, forecast_sku


DEFAULT_LEAD_DAYS = 7
SAFETY_DAYS = 3


def compute_rop(avg_daily: float, lead_days: int = DEFAULT_LEAD_DAYS, safety_days: int = SAFETY_DAYS) -> float:
    return avg_daily * (lead_days + safety_days)


def suggest_qty(avg_daily: float, current_stock: float, rop: float, lead_days: int = DEFAULT_LEAD_DAYS) -> int:
    target = avg_daily * (lead_days + SAFETY_DAYS + 14)  # cover lead + safety + 2 weeks
    need = max(0.0, target - current_stock)
    return max(1, int(math.ceil(need)))


def evaluate_reorder(
    *,
    tenant_id: str,
    product: dict[str, Any],
    lines: list[dict[str, Any]],
    category_velocity: float | None = None,
    lead_days: int = DEFAULT_LEAD_DAYS,
) -> dict[str, Any] | None:
    sku = str(product.get("sku") or "")
    if not sku:
        return None
    result: ForecastResult = forecast_sku(
        sku=sku,
        lines=lines,
        product=product,
        category_velocity=category_velocity,
    )
    stock = float(product.get("stock") or 0)
    rop = compute_rop(result.avg_daily, lead_days=lead_days)
    if stock > rop:
        return None
    qty = suggest_qty(result.avg_daily, stock, rop, lead_days=lead_days)
    return build_reorder_proposal(
        tenant_id,
        product,
        qty=qty,
        rop=rop,
        avg_daily=result.avg_daily,
        method=result.method,
    )


def build_reorder_proposal(
    tenant_id: str,
    product: dict[str, Any],
    *,
    qty: int,
    rop: float,
    avg_daily: float,
    method: str,
) -> dict[str, Any]:
    sku = str(product.get("sku") or "")
    name = str(product.get("name") or sku)
    stock = product.get("stock")
    return {
        "business_id": tenant_id,
        "kind": "reorder",
        "function_id": "reorder",
        "entity_type": "product",
        "entity_id": str(product.get("id") or ""),
        "score": 0.82,
        "unique_top": True,
        "model_version": f"rop-{method}",
        "explanation": (
            f"{name} stock {stock} ≤ ROP {rop:.1f} "
            f"(~{avg_daily:.2f}/day × lead+safety). Suggest PO qty {qty}."
        ),
        "payload": {
            "product_id": product.get("id"),
            "sku": sku,
            "product_name": name,
            "qty": qty,
            "rop": rop,
            "avg_daily": avg_daily,
            "stock": stock,
        },
    }
