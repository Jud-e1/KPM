"""Outbox poller: consume ml_events → score → POST proposals to core."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app import db as tenant_db
from app.config import settings
from app.core_client import fetch_pending_events, mark_processed, post_proposal
from app.services.anomaly import build_anomaly_proposal, detect_anomaly
from app.services.forecast import build_forecast_proposal, forecast_sku
from app.services.reconciliation import build_reconcile_proposal
from app.services.risk import build_risk_proposal, score_customer, score_supplier
from app.services.rop import evaluate_reorder

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("ml.worker")


def _payload(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("payload_json") or "{}"
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _run_forecast_and_rop(tenant_id: str, product: dict[str, Any] | None = None) -> None:
    lines = tenant_db.sales_order_lines(tenant_id)
    products = [product] if product else tenant_db.list_products(tenant_id)
    # category velocity for cold start
    cat_qty: dict[str, float] = {}
    cat_n: dict[str, int] = {}
    prod_by_sku = {str(p.get("sku") or ""): p for p in tenant_db.list_products(tenant_id)}
    for line in lines:
        sku = str(line.get("sku") or "")
        p = prod_by_sku.get(sku)
        if not p:
            continue
        cat = str(p.get("category") or "General")
        cat_qty[cat] = cat_qty.get(cat, 0.0) + float(line.get("qty") or 0)
        cat_n[cat] = cat_n.get(cat, 0) + 1

    for p in products:
        sku = str(p.get("sku") or "")
        if not sku:
            continue
        cat = str(p.get("category") or "General")
        velocity = (cat_qty.get(cat, 0.0) / max(cat_n.get(cat, 1), 1) / 30.0) if cat in cat_qty else None
        result = forecast_sku(sku=sku, lines=lines, product=p, category_velocity=velocity)
        post_proposal(build_forecast_proposal(tenant_id, result, str(p.get("id") or "")))
        reorder = evaluate_reorder(
            tenant_id=tenant_id,
            product=p,
            lines=lines,
            category_velocity=velocity,
        )
        if reorder:
            post_proposal(reorder)


def _run_risk_cards(tenant_id: str) -> None:
    orders = tenant_db.recent_orders(tenant_id, limit=300)
    txs = tenant_db.recent_transactions(tenant_id, limit=300)
    reqs = tenant_db.list_supplier_requests(tenant_id)
    for c in tenant_db.list_customers(tenant_id):
        card = score_customer(c, orders=orders, transactions=txs)
        if card["score"] >= 0.4:
            post_proposal(build_risk_proposal(tenant_id, card))
    for s in tenant_db.list_suppliers(tenant_id):
        card = score_supplier(s, requests=reqs, transactions=txs)
        if card["score"] >= 0.4:
            post_proposal(build_risk_proposal(tenant_id, card))


def handle_event(event: dict[str, Any]) -> None:
    tenant_id = event.get("business_id") or event.get("tenant_id")
    event_type = event["event_type"]
    payload = _payload(event)
    logger.info("Handling %s for tenant %s", event_type, tenant_id)

    if event_type in ("payment.received", "transaction.created"):
        tx_id = payload.get("transaction_id") or payload.get("id")
        tx = tenant_db.get_transaction(tenant_id, str(tx_id)) if tx_id else None
        if not tx:
            tx = {
                "id": tx_id,
                **payload,
            }
        amount = float(tx.get("amount") or 0)
        if amount > 0 or (tx.get("transaction_type") or "").lower() in (
            "credit",
            "income",
            "payment",
            "inflow",
        ):
            proposal = build_reconcile_proposal(
                tenant_id,
                tx,
                tenant_db.open_orders(tenant_id),
                confirmed_match_count=tenant_db.confirmed_match_count(tenant_id),
            )
            if proposal:
                post_proposal(proposal)

        txs = tenant_db.recent_transactions(tenant_id)
        known = tenant_db.counterparties(tenant_id)
        cp = (tx.get("counterparty") or "").strip().lower()
        known_before = (
            {c for c in known if c != cp}
            if sum(1 for t in txs if (t.get("counterparty") or "").strip().lower() == cp) <= 1
            else known
        )
        hit = detect_anomaly(
            tenant_id,
            entity_type="transaction",
            entity=tx,
            transactions=txs,
            known_counterparties=known_before,
            tx_count=tenant_db.transaction_count(tenant_id),
            context={
                "amount_median_ratio": 1.0,
                "new_counterparty": bool(cp and cp not in known_before),
            },
        )
        if hit:
            post_proposal(build_anomaly_proposal(tenant_id, hit))

    elif event_type in ("order.created", "invoice.posted"):
        order_id = payload.get("order_id") or payload.get("id")
        orders = tenant_db.recent_orders(tenant_id)
        entity = next((o for o in orders if str(o.get("id")) == str(order_id)), None) or {
            "id": order_id,
            **payload,
        }
        hit = detect_anomaly(
            tenant_id,
            entity_type="order",
            entity=entity,
            sibling_orders=orders,
            tx_count=tenant_db.transaction_count(tenant_id),
            context={"orders_today": 0},
        )
        if hit:
            post_proposal(build_anomaly_proposal(tenant_id, hit))
        _run_forecast_and_rop(tenant_id)
        _run_risk_cards(tenant_id)

    elif event_type == "stock.adjusted":
        product_id = payload.get("product_id")
        product = tenant_db.get_product(tenant_id, str(product_id)) if product_id else None
        if not product:
            product = {"id": product_id, **payload}
        last_prices = {}
        if payload.get("price") is not None and payload.get("prev_price") is not None:
            last_prices[str(product.get("sku") or "")] = float(payload["prev_price"])
        hit = detect_anomaly(
            tenant_id,
            entity_type="product",
            entity=product,
            last_prices=last_prices,
            tx_count=tenant_db.transaction_count(tenant_id),
        )
        if hit:
            post_proposal(build_anomaly_proposal(tenant_id, hit))
        _run_forecast_and_rop(tenant_id, product=product)

    else:
        logger.debug("No handler for event_type=%s", event_type)


def poll_once(limit: int = 50) -> int:
    events = fetch_pending_events(limit=limit)
    for event in events:
        try:
            handle_event(event)
        except Exception as exc:
            logger.exception("Error handling event %s: %s", event.get("id"), exc)
        finally:
            mark_processed(event["id"])
    return len(events)


def run_forever() -> None:
    logger.info(
        "ML worker started; polling %s every %ss",
        settings.CORE_API_BASE,
        settings.POLL_INTERVAL_SEC,
    )
    while True:
        n = poll_once()
        if n == 0:
            time.sleep(settings.POLL_INTERVAL_SEC)
        else:
            time.sleep(0.5)


if __name__ == "__main__":
    run_forever()
