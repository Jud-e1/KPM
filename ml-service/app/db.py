"""Read business-scoped candidates from the shared core DB (never cross-tenant)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.config import settings

logger = logging.getLogger(__name__)

_engine: Engine | None = None


def get_engine() -> Engine | None:
    global _engine
    if _engine is not None:
        return _engine
    try:
        connect_timeout = 10 if settings.ENVIRONMENT == "production" else 3
        eng = create_engine(
            settings.sync_database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=1800,
            connect_args={"connect_timeout": connect_timeout},
        )
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        _engine = eng
        return _engine
    except Exception as exc:
        if settings.ENVIRONMENT == "production":
            logger.error("PostgreSQL is required in production and was not reachable: %s", exc)
            raise
        logger.warning("ML service could not connect to Postgres (%s); using SQLite fallback if present.", exc)
        try:
            candidates = [
                Path(__file__).resolve().parents[2] / "backend" / "kpm_app.db",
                Path("kpm_app.db"),
            ]
            for path in candidates:
                if path.exists():
                    _engine = create_engine(
                        f"sqlite:///{path}",
                        connect_args={"check_same_thread": False},
                    )
                    return _engine
        except Exception as sqlite_exc:
            logger.error("SQLite fallback failed: %s", sqlite_exc)
        return None


def _rows(sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    eng = get_engine()
    if eng is None:
        return []
    with eng.connect() as conn:
        result = conn.execute(text(sql), params)
        return [dict(r._mapping) for r in result]


def open_orders(business_id: str) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, order_number, customer_name, items_count, total_amount, status,
               channel, order_date, created_at
        FROM sales_orders
        WHERE business_id = :business_id
          AND lower(status) NOT IN ('cancelled', 'canceled', 'matched', 'paid')
        ORDER BY created_at DESC
        LIMIT 200
        """,
        {"business_id": business_id},
    )


def recent_orders(business_id: str, limit: int = 100) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, order_number, customer_name, items_count, total_amount, status,
               channel, order_date, created_at
        FROM sales_orders
        WHERE business_id = :business_id
        ORDER BY created_at DESC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def get_transaction(business_id: str, tx_id: str) -> dict[str, Any] | None:
    rows = _rows(
        """
        SELECT id, transaction_date, description, reference, counterparty, category,
               account, transaction_type, amount, status, created_at
        FROM accounting_transactions
        WHERE business_id = :business_id AND id = :tx_id
        """,
        {"business_id": business_id, "tx_id": tx_id},
    )
    return rows[0] if rows else None


def recent_transactions(business_id: str, limit: int = 300) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, transaction_date, description, reference, counterparty, category,
               account, transaction_type, amount, status, created_at
        FROM accounting_transactions
        WHERE business_id = :business_id
        ORDER BY transaction_date DESC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def transaction_count(business_id: str) -> int:
    rows = _rows(
        "SELECT COUNT(*) AS c FROM accounting_transactions WHERE business_id = :business_id",
        {"business_id": business_id},
    )
    return int(rows[0]["c"]) if rows else 0


def confirmed_match_count(business_id: str) -> int:
    rows = _rows(
        "SELECT COUNT(*) AS c FROM ml_match_links WHERE business_id = :business_id",
        {"business_id": business_id},
    )
    return int(rows[0]["c"]) if rows else 0


def get_product(business_id: str, product_id: str) -> dict[str, Any] | None:
    rows = _rows(
        """
        SELECT id, name, sku, category, stock, status, price, low_stock_threshold
        FROM inventory_products
        WHERE business_id = :business_id AND id = :product_id
        """,
        {"business_id": business_id, "product_id": product_id},
    )
    return rows[0] if rows else None


def counterparties(business_id: str) -> set[str]:
    rows = _rows(
        """
        SELECT DISTINCT lower(counterparty) AS cp
        FROM accounting_transactions
        WHERE business_id = :business_id AND counterparty IS NOT NULL AND counterparty != ''
        """,
        {"business_id": business_id},
    )
    return {str(r["cp"]) for r in rows if r.get("cp")}


def list_products(business_id: str, limit: int = 500) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, name, sku, category, stock, status, price, low_stock_threshold
        FROM inventory_products
        WHERE business_id = :business_id
        ORDER BY name ASC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def sales_order_lines(business_id: str, limit: int = 5000) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT l.id, l.order_id, l.product_id, l.sku, l.qty, l.unit_price, l.line_total,
               o.order_date, o.created_at, o.status
        FROM sales_order_lines l
        JOIN sales_orders o ON o.id = l.order_id
        WHERE l.business_id = :business_id
        ORDER BY o.created_at DESC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def list_customers(business_id: str, limit: int = 500) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, name, email, company, total_spent, last_order, status
        FROM customers
        WHERE business_id = :business_id
        ORDER BY name ASC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def list_suppliers(business_id: str, limit: int = 500) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, name, location, status, spend_this_month
        FROM suppliers
        WHERE business_id = :business_id
        ORDER BY name ASC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )


def list_supplier_requests(business_id: str, limit: int = 500) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id, need, category, budget, status, created_at
        FROM supplier_requests
        WHERE business_id = :business_id
        ORDER BY created_at DESC
        LIMIT :limit
        """,
        {"business_id": business_id, "limit": limit},
    )
