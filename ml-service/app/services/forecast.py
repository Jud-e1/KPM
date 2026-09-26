"""Demand forecast per SKU: Croston for intermittent, else simple Holt."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np


@dataclass
class ForecastResult:
    sku: str
    points: list[dict[str, Any]]
    method: str
    avg_daily: float


def _parse_day(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "").split("+")[0]).date()
    except Exception:
        return None


def daily_demand_from_lines(lines: list[dict[str, Any]], sku: str, lookback_days: int = 90) -> list[float]:
    end = date.today()
    start = end - timedelta(days=lookback_days - 1)
    buckets = {start + timedelta(days=i): 0.0 for i in range(lookback_days)}
    for line in lines:
        if str(line.get("sku") or "") != sku:
            continue
        d = _parse_day(line.get("order_date") or line.get("created_at"))
        if d is None or d < start or d > end:
            continue
        buckets[d] = buckets.get(d, 0.0) + float(line.get("qty") or 0)
    return [buckets[start + timedelta(days=i)] for i in range(lookback_days)]


def _is_intermittent(series: list[float]) -> bool:
    if not series:
        return True
    nonzero = sum(1 for x in series if x > 0)
    return (nonzero / len(series)) < 0.3


def croston(series: list[float], horizon: int = 14, alpha: float = 0.1) -> list[float]:
    demand = 0.0
    interval = 1.0
    since = 0
    for x in series:
        if x > 0:
            since = max(since, 1)
            demand = demand + alpha * (x - demand) if demand else x
            interval = interval + alpha * (since - interval) if interval else since
            since = 0
        else:
            since += 1
    rate = (demand / interval) if interval else 0.0
    return [rate] * horizon


def holt_simple(series: list[float], horizon: int = 14, alpha: float = 0.3, beta: float = 0.1) -> list[float]:
    if not series:
        return [0.0] * horizon
    level = float(series[0])
    trend = float(series[1] - series[0]) if len(series) > 1 else 0.0
    for x in series[1:]:
        prev = level
        level = alpha * x + (1 - alpha) * (level + trend)
        trend = beta * (level - prev) + (1 - beta) * trend
    return [max(0.0, level + (i + 1) * trend) for i in range(horizon)]


def cold_start_daily(product: dict[str, Any], category_velocity: float | None = None) -> float:
    thr = float(product.get("low_stock_threshold") or 5)
    if category_velocity and category_velocity > 0:
        return float(category_velocity)
    return max(0.1, thr / 14.0)


def forecast_sku(
    *,
    sku: str,
    lines: list[dict[str, Any]],
    product: dict[str, Any] | None = None,
    category_velocity: float | None = None,
    horizon: int = 14,
) -> ForecastResult:
    series = daily_demand_from_lines(lines, sku)
    if sum(series) <= 0:
        daily = cold_start_daily(product or {}, category_velocity)
        points = [
            {
                "date": (date.today() + timedelta(days=i + 1)).isoformat(),
                "sku": sku,
                "demand": round(daily, 4),
                "method": "cold_start",
            }
            for i in range(horizon)
        ]
        return ForecastResult(sku=sku, points=points, method="cold_start", avg_daily=daily)

    if _is_intermittent(series):
        preds = croston(series, horizon=horizon)
        method = "croston"
    else:
        preds = holt_simple(series, horizon=horizon)
        method = "holt"
    avg = float(np.mean(preds)) if preds else 0.0
    points = [
        {
            "date": (date.today() + timedelta(days=i + 1)).isoformat(),
            "sku": sku,
            "demand": round(float(p), 4),
            "method": method,
        }
        for i, p in enumerate(preds)
    ]
    return ForecastResult(sku=sku, points=points, method=method, avg_daily=avg)


def build_forecast_proposal(tenant_id: str, result: ForecastResult, product_id: str) -> dict[str, Any]:
    return {
        "business_id": tenant_id,
        "kind": "forecast",
        "function_id": "forecast",
        "entity_type": "product",
        "entity_id": product_id,
        "score": 0.7,
        "unique_top": True,
        "model_version": result.method,
        "explanation": f"Forecast {result.sku}: ~{result.avg_daily:.2f}/day via {result.method}",
        "payload": {
            "sku": result.sku,
            "method": result.method,
            "avg_daily": result.avg_daily,
            "points": result.points,
        },
    }
