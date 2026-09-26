"""Insights Q&A with optional OpenAI tool-calling + forecast series."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.models.accounting import AccountingTransactionModel
from app.models.inventory import Product
from app.models.ml import MlAnomalyFlagModel, MlProposalModel
from app.models.partners import CustomerModel, SupplierModel
from app.models.sales import SalesOrderLineModel, SalesOrderModel
from app.models.user import User

router = APIRouter()


class InsightAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    context: Optional[dict[str, Any]] = None


class InsightAskResponse(BaseModel):
    answer: str
    provider: str  # "openai" | "rules"
    model: Optional[str] = None
    tool_trace: Optional[list[dict[str, Any]]] = None


class ForecastPointOut(BaseModel):
    date: str
    sku: str
    demand: float
    method: str


def build_rules_answer(question: str, context: dict[str, Any]) -> str:
    q = question.lower()
    revenue = context.get("revenue")
    orders = context.get("orders")
    low_stock = context.get("low_stock")
    products = context.get("products")
    org = context.get("organization") or "your business"
    if any(word in q for word in ("sales", "trend", "forecast", "revenue")):
        return f"Sales for {org}: revenue {revenue}, orders {orders}. Ask about stock or margin for more detail."
    if any(word in q for word in ("stock", "inventory", "low")):
        return f"Inventory for {org}: {low_stock} low-stock items across {products} SKUs."
    if any(word in q for word in ("profit", "margin", "financ", "expense")):
        return f"Finance snapshot for {org}: revenue {revenue}. Review Accounting for expense and margin detail."
    return (
        f"For {org}: revenue {revenue}, {orders} orders, {products} products, {low_stock} low-stock alerts. "
        "Ask about sales, stock, or finances."
    )


def gather_context(db: Session, user: User, extra: Optional[dict[str, Any]]) -> dict[str, Any]:
    products = db.query(Product).filter(Product.business_id == user.id).all()
    orders = db.query(SalesOrderModel).filter(SalesOrderModel.business_id == user.id).all()
    income = sum(
        t.amount
        for t in db.query(AccountingTransactionModel).filter(
            AccountingTransactionModel.business_id == user.id,
            AccountingTransactionModel.transaction_type == "Income",
        )
    )
    low_stock = sum(1 for p in products if (p.stock or 0) <= (p.low_stock_threshold or 15))
    ctx = {
        "organization": user.organization or user.full_name,
        "products": len(products),
        "low_stock": low_stock,
        "orders": len(orders),
        "revenue": f"${income:,.0f}",
    }
    if extra:
        ctx.update({k: v for k, v in extra.items() if v is not None})
    return ctx


TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "list_products",
            "description": "List products for the current tenant (id, name, sku, stock, low_stock_threshold).",
            "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_orders",
            "description": "List recent sales orders.",
            "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_transactions",
            "description": "List recent accounting transactions.",
            "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_customers",
            "description": "List customers.",
            "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_suppliers",
            "description": "List suppliers.",
            "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ml_flags_summary",
            "description": "Summarize open ML anomaly flags for the tenant.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
]


def _run_tool(db: Session, owner_id: str, name: str, args: dict[str, Any]) -> Any:
    limit = min(int(args.get("limit") or 50), 100)
    if name == "list_products":
        rows = (
            db.query(Product)
            .filter(Product.business_id == owner_id)
            .order_by(Product.name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "name": r.name,
                "sku": r.sku,
                "stock": r.stock,
                "low_stock_threshold": r.low_stock_threshold,
                "status": r.status,
            }
            for r in rows
        ]
    if name == "list_orders":
        rows = (
            db.query(SalesOrderModel)
            .filter(SalesOrderModel.business_id == owner_id)
            .order_by(SalesOrderModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "order_number": r.order_number,
                "customer_name": r.customer_name,
                "total_amount": r.total_amount,
                "status": r.status,
            }
            for r in rows
        ]
    if name == "list_transactions":
        rows = (
            db.query(AccountingTransactionModel)
            .filter(AccountingTransactionModel.business_id == owner_id)
            .order_by(AccountingTransactionModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "description": r.description,
                "amount": r.amount,
                "type": r.transaction_type,
                "status": r.status,
            }
            for r in rows
        ]
    if name == "list_customers":
        rows = (
            db.query(CustomerModel)
            .filter(CustomerModel.business_id == owner_id)
            .order_by(CustomerModel.name.asc())
            .limit(limit)
            .all()
        )
        return [{"id": r.id, "name": r.name, "total_spent": r.total_spent, "status": r.status} for r in rows]
    if name == "list_suppliers":
        rows = (
            db.query(SupplierModel)
            .filter(SupplierModel.business_id == owner_id)
            .order_by(SupplierModel.name.asc())
            .limit(limit)
            .all()
        )
        return [{"id": r.id, "name": r.name, "status": r.status, "spend": r.spend_this_month} for r in rows]
    if name == "ml_flags_summary":
        flags = (
            db.query(MlAnomalyFlagModel)
            .filter(MlAnomalyFlagModel.business_id == owner_id, MlAnomalyFlagModel.status == "open")
            .all()
        )
        return {
            "open_count": len(flags),
            "by_severity": {
                "hard": sum(1 for f in flags if f.severity == "hard"),
                "soft": sum(1 for f in flags if f.severity != "hard"),
            },
            "samples": [{"id": f.id, "explanation": f.explanation, "score": f.score} for f in flags[:10]],
        }
    return {"error": f"unknown tool {name}"}


async def ask_openai_with_tools(
    question: str,
    context: dict[str, Any],
    db: Session,
    owner_id: str,
) -> tuple[Optional[str], list[dict[str, Any]]]:
    if not settings.OPENAI_API_KEY:
        return None, []
    system = (
        "You are KPM's business assistant. Use tools to read tenant-scoped data when needed. "
        "Answer clearly and briefly. Do not invent numbers."
    )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Context snapshot: {context}\n\nQuestion: {question}"},
    ]
    trace: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            for _ in range(4):
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.OPENAI_MODEL,
                        "messages": messages,
                        "tools": TOOL_DEFS,
                        "tool_choice": "auto",
                        "temperature": 0.2,
                    },
                )
                if res.status_code >= 400:
                    return None, trace
                data = res.json()
                msg = data["choices"][0]["message"]
                tool_calls = msg.get("tool_calls") or []
                if not tool_calls:
                    content = (msg.get("content") or "").strip()
                    return content or None, trace
                messages.append(msg)
                for call in tool_calls:
                    fn = call.get("function") or {}
                    name = fn.get("name") or ""
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except Exception:
                        args = {}
                    result = _run_tool(db, owner_id, name, args)
                    trace.append({"tool": name, "args": args, "result_preview": str(result)[:400]})
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.get("id"),
                            "content": json.dumps(result, default=str)[:8000],
                        }
                    )
    except Exception:
        return None, trace
    return None, trace


def _forecast_points_for_sku(
    sku: str,
    lines: list[SalesOrderLineModel],
    product: Product | None,
    horizon: int = 14,
) -> list[ForecastPointOut]:
    end = date.today()
    lookback = 90
    start = end - timedelta(days=lookback - 1)
    buckets = {start + timedelta(days=i): 0.0 for i in range(lookback)}
    for line in lines:
        if (line.sku or "") != sku:
            continue
        order = line.order if hasattr(line, "order") else None
        d = None
        # lines may not have relationship loaded — use created via join fields if present
        raw = getattr(line, "_order_date", None)
        if raw is None and order is not None:
            raw = getattr(order, "order_date", None) or getattr(order, "created_at", None)
        if isinstance(raw, datetime):
            d = raw.date()
        elif isinstance(raw, date):
            d = raw
        elif raw:
            try:
                d = datetime.fromisoformat(str(raw).replace("Z", "").split("+")[0]).date()
            except Exception:
                d = None
        if d is None or d < start or d > end:
            continue
        buckets[d] = buckets.get(d, 0.0) + float(line.qty or 0)
    series = [buckets[start + timedelta(days=i)] for i in range(lookback)]
    total = sum(series)
    if total <= 0:
        return []
    else:
        nonzero = sum(1 for x in series if x > 0)
        intermittent = (nonzero / len(series)) < 0.3
        if intermittent:
            # croston-lite
            demand = 0.0
            interval = 1.0
            since = 0
            alpha = 0.1
            for x in series:
                if x > 0:
                    since = max(since, 1)
                    demand = demand + alpha * (x - demand) if demand else x
                    interval = interval + alpha * (since - interval) if interval else since
                    since = 0
                else:
                    since += 1
            rate = (demand / interval) if interval else 0.0
            preds = [rate] * horizon
            method = "croston"
        else:
            level = float(series[0])
            trend = float(series[1] - series[0]) if len(series) > 1 else 0.0
            alpha, beta = 0.3, 0.1
            for x in series[1:]:
                prev = level
                level = alpha * x + (1 - alpha) * (level + trend)
                trend = beta * (level - prev) + (1 - beta) * trend
            preds = [max(0.0, level + (i + 1) * trend) for i in range(horizon)]
            method = "holt"
    return [
        ForecastPointOut(
            date=(date.today() + timedelta(days=i + 1)).isoformat(),
            sku=sku,
            demand=round(float(p), 4),
            method=method,
        )
        for i, p in enumerate(preds)
    ]


@router.get("/forecast", response_model=list[ForecastPointOut])
def get_forecast(
    sku: Optional[str] = None,
    days: int = Query(14, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Prefer latest ML forecast proposal payload when present
    if sku:
        prop = (
            db.query(MlProposalModel)
            .filter(
                MlProposalModel.business_id == require_business_id(current_user),
                MlProposalModel.kind == "forecast",
                MlProposalModel.status.in_(["suggested", "applied", "pending"]),
            )
            .order_by(MlProposalModel.created_at.desc())
            .all()
        )
        for p in prop:
            try:
                payload = json.loads(p.payload_json or "{}")
            except Exception:
                continue
            if str(payload.get("sku") or "") != sku:
                continue
            points = payload.get("points") or []
            if points:
                return [
                    ForecastPointOut(
                        date=str(pt.get("date")),
                        sku=str(pt.get("sku") or sku),
                        demand=float(pt.get("demand") or 0),
                        method=str(pt.get("method") or p.model_version or "ml"),
                    )
                    for pt in points[:days]
                ]

    products = db.query(Product).filter(Product.business_id == require_business_id(current_user)).all()
    if sku:
        products = [p for p in products if p.sku == sku]
    lines = (
        db.query(SalesOrderLineModel, SalesOrderModel.order_date, SalesOrderModel.created_at)
        .join(SalesOrderModel, SalesOrderModel.id == SalesOrderLineModel.order_id)
        .filter(SalesOrderLineModel.business_id == require_business_id(current_user))
        .all()
    )
    # attach order dates onto line-like objects
    line_objs: list[Any] = []
    for line, order_date, created_at in lines:
        line._order_date = order_date or created_at
        line_objs.append(line)

    out: list[ForecastPointOut] = []
    for product in products[:20]:
        out.extend(_forecast_points_for_sku(product.sku, line_objs, product, horizon=days))
    return out


@router.post("/ask", response_model=InsightAskResponse)
async def ask_insight(
    payload: InsightAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context = gather_context(db, current_user, payload.context)
    llm_answer, trace = await ask_openai_with_tools(
        payload.question.strip(), context, db, require_business_id(current_user)
    )
    if llm_answer:
        return InsightAskResponse(
            answer=llm_answer,
            provider="openai",
            model=settings.OPENAI_MODEL,
            tool_trace=trace or None,
        )
    return InsightAskResponse(
        answer=build_rules_answer(payload.question.strip(), context),
        provider="rules",
        model=None,
        tool_trace=None,
    )


@router.get("/provider")
def insight_provider():
    return {
        "provider": "openai" if settings.OPENAI_API_KEY else "rules",
        "model": settings.OPENAI_MODEL if settings.OPENAI_API_KEY else None,
    }
