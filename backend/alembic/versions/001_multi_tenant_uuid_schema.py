"""Multi-tenant UUID schema with businesses + RLS.

Revision ID: 001_multi_tenant
Revises:
Create Date: 2026-09-25

Strategy:
- Fresh databases: create full metadata schema, then enable RLS (Postgres).
- Legacy databases with owner_id/tenant_id: rebuild via create_all after
  renaming old tables, with deterministic UUID backfill where possible.
"""
from __future__ import annotations

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision: str = "001_multi_tenant"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

KPM_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _stable(legacy: str) -> str:
    return str(uuid.uuid5(KPM_NS, f"kpm:{legacy}"))


DOMAIN_TABLES = [
    "inventory_products",
    "sales_orders",
    "sales_order_lines",
    "accounting_transactions",
    "accounting_profiles",
    "accounting_activities",
    "customers",
    "suppliers",
    "supplier_requests",
    "onboarding_profiles",
    "onboarding_integrations",
    "onboarding_automations",
    "purchase_drafts",
    "ml_events",
    "ml_proposals",
    "ml_audit_actions",
    "ml_match_links",
    "ml_anomaly_flags",
    "ml_drift_stats",
    "ml_risk_scores",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    dialect = bind.dialect.name

    from app.core.database import Base
    import app.models  # noqa: F401

    if "businesses" not in tables:
        # Prefer metadata create for full new schema when empty-ish,
        # otherwise create missing core tenancy first then recreate domain.
        if "users" in tables and dialect == "postgresql":
            _migrate_legacy_postgres(bind, tables)
        else:
            # Dev / SQLite / empty: drop known domain leftovers then create_all
            for name in list(DOMAIN_TABLES) + ["business_memberships", "businesses", "users", "items"]:
                if name in tables:
                    op.execute(sa.text(f'DROP TABLE IF EXISTS "{name}" CASCADE' if dialect == "postgresql" else f"DROP TABLE IF EXISTS {name}"))
            Base.metadata.create_all(bind=bind)

    if dialect == "postgresql":
        _enable_rls(bind)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in DOMAIN_TABLES + ["business_memberships", "businesses"]:
            op.execute(sa.text(f'ALTER TABLE IF EXISTS "{table}" DISABLE ROW LEVEL SECURITY'))
    # Non-destructive downgrade not supported for UUID cutover
    raise NotImplementedError("Downgrade from multi-tenant UUID schema is not supported")


def _migrate_legacy_postgres(bind, tables: set[str]) -> None:
    """Best-effort migration from string owner_id tenancy to business UUID tenancy."""
    conn = bind

    # 1) Create mapping of old user id -> new uuid
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS _id_map (
                old_id VARCHAR(64) PRIMARY KEY,
                new_id UUID NOT NULL
            )
            """
        )
    )
    users = conn.execute(text("SELECT id, email, full_name, hashed_password, organization, business_type, role, is_active, created_at, updated_at FROM users")).mappings().all()
    for u in users:
        new_id = _stable(str(u["id"]))
        conn.execute(
            text("INSERT INTO _id_map(old_id, new_id) VALUES (:o, CAST(:n AS uuid)) ON CONFLICT (old_id) DO NOTHING"),
            {"o": str(u["id"]), "n": new_id},
        )

    # 2) Recreate users with UUID PKs (via swap)
    conn.execute(text("ALTER TABLE users RENAME TO users_legacy"))
    from app.core.database import Base
    import app.models  # noqa: F401

    Base.metadata.tables["users"].create(bind=conn)
    Base.metadata.tables["businesses"].create(bind=conn)
    Base.metadata.tables["business_memberships"].create(bind=conn)

    for u in users:
        new_id = _stable(str(u["id"]))
        conn.execute(
            text(
                """
                INSERT INTO users (id, email, full_name, hashed_password, organization, business_type, role, is_active, created_at, updated_at)
                VALUES (CAST(:id AS uuid), :email, :full_name, :hashed_password, :organization, :business_type, :role, :is_active, :created_at, :updated_at)
                """
            ),
            {
                "id": new_id,
                "email": u["email"],
                "full_name": u["full_name"],
                "hashed_password": u["hashed_password"],
                "organization": u.get("organization"),
                "business_type": u.get("business_type"),
                "role": u.get("role") or "Admin",
                "is_active": bool(u.get("is_active", True)),
                "created_at": u.get("created_at"),
                "updated_at": u.get("updated_at"),
            },
        )
        biz_id = _stable(f"biz:{u['id']}")
        conn.execute(
            text(
                """
                INSERT INTO businesses (id, owner_user_id, name, business_type, currency, created_at, updated_at)
                VALUES (CAST(:bid AS uuid), CAST(:uid AS uuid), :name, :btype, 'USD', NOW(), NOW())
                """
            ),
            {
                "bid": biz_id,
                "uid": new_id,
                "name": (u.get("organization") or u["full_name"] or "My Business")[:120],
                "btype": u.get("business_type"),
            },
        )
        conn.execute(
            text(
                """
                INSERT INTO business_memberships (id, business_id, user_id, role, created_at)
                VALUES (CAST(:mid AS uuid), CAST(:bid AS uuid), CAST(:uid AS uuid), 'Admin', NOW())
                """
            ),
            {"mid": _stable(f"mem:{u['id']}"), "bid": biz_id, "uid": new_id},
        )
        conn.execute(
            text("INSERT INTO _id_map(old_id, new_id) VALUES (:o, CAST(:n AS uuid)) ON CONFLICT (old_id) DO NOTHING"),
            {"o": f"biz:{u['id']}", "n": biz_id},
        )

    # 3) Recreate domain tables from metadata and copy rows where owner_id/tenant_id present
    for name in DOMAIN_TABLES:
        if name in tables:
            conn.execute(text(f'ALTER TABLE "{name}" RENAME TO "{name}_legacy"'))
        if name in Base.metadata.tables:
            Base.metadata.tables[name].create(bind=conn)

    _copy_domain(conn, "inventory_products", tenant_col="owner_id")
    _copy_domain(conn, "sales_orders", tenant_col="owner_id")
    _copy_domain(conn, "sales_order_lines", tenant_col="owner_id")
    _copy_domain(conn, "customers", tenant_col="owner_id")
    _copy_domain(conn, "suppliers", tenant_col="owner_id")
    _copy_domain(conn, "supplier_requests", tenant_col="owner_id")
    _copy_domain(conn, "accounting_transactions", tenant_col="owner_id")
    _copy_domain(conn, "accounting_profiles", tenant_col="owner_id")
    _copy_domain(conn, "accounting_activities", tenant_col="owner_id")
    _copy_domain(conn, "onboarding_profiles", tenant_col="owner_id")
    _copy_domain(conn, "onboarding_integrations", tenant_col="owner_id")
    _copy_domain(conn, "onboarding_automations", tenant_col="owner_id")
    _copy_domain(conn, "purchase_drafts", tenant_col="tenant_id")
    for ml in (
        "ml_events",
        "ml_proposals",
        "ml_audit_actions",
        "ml_match_links",
        "ml_anomaly_flags",
        "ml_drift_stats",
        "ml_risk_scores",
    ):
        _copy_domain(conn, ml, tenant_col="tenant_id")

    conn.execute(text("DROP TABLE IF EXISTS users_legacy CASCADE"))
    for name in DOMAIN_TABLES:
        conn.execute(text(f'DROP TABLE IF EXISTS "{name}_legacy" CASCADE'))
    conn.execute(text("DROP TABLE IF EXISTS _id_map"))


def _copy_domain(conn, table: str, tenant_col: str) -> None:
    legacy = f"{table}_legacy"
    inspector = inspect(conn)
    if legacy not in inspector.get_table_names():
        return
    cols = [c["name"] for c in inspector.get_columns(legacy)]
    if tenant_col not in cols:
        return
    rows = conn.execute(text(f'SELECT * FROM "{legacy}"')).mappings().all()
    if not rows:
        return
    new_cols = [c["name"] for c in inspector.get_columns(table)]
    for row in rows:
        owner = str(row.get(tenant_col) or "")
        if not owner:
            continue
        biz_id = _stable(f"biz:{owner}")
        payload = {}
        for col in new_cols:
            if col == "business_id":
                payload[col] = biz_id
            elif col == "id":
                payload[col] = _stable(str(row.get("id")))
            elif col in row:
                val = row[col]
                # remap soft FK ids when present in map
                if col.endswith("_id") and val and col not in ("business_id",):
                    mapped = conn.execute(
                        text("SELECT new_id FROM _id_map WHERE old_id = :o"),
                        {"o": str(val)},
                    ).scalar()
                    payload[col] = str(mapped) if mapped else _stable(str(val))
                else:
                    payload[col] = val
            else:
                continue
        keys = list(payload.keys())
        placeholders = ", ".join([f"CAST(:{k} AS uuid)" if k.endswith("_id") or k == "id" else f":{k}" for k in keys])
        # Simplify: cast only known uuid fields
        uuid_fields = {"id", "business_id"} | {k for k in keys if k.endswith("_id")}
        ph = []
        for k in keys:
            if k in uuid_fields and payload[k] is not None:
                ph.append(f"CAST(:{k} AS uuid)")
            else:
                ph.append(f":{k}")
        sql = f'INSERT INTO "{table}" ({", ".join(keys)}) VALUES ({", ".join(ph)}) ON CONFLICT DO NOTHING'
        try:
            conn.execute(text(sql), payload)
        except Exception:
            # Skip incompatible legacy rows rather than failing the whole migration
            continue


def _enable_rls(bind) -> None:
    tables = DOMAIN_TABLES + ["business_memberships"]
    for table in tables:
        bind.execute(text(f'ALTER TABLE IF EXISTS "{table}" ENABLE ROW LEVEL SECURITY'))
        bind.execute(text(f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"'))
        bind.execute(
            text(
                f"""
                CREATE POLICY tenant_isolation ON "{table}"
                USING (business_id::text = NULLIF(current_setting('app.current_business_id', true), ''))
                WITH CHECK (business_id::text = NULLIF(current_setting('app.current_business_id', true), ''))
                """
            )
        )
    # businesses: members can see their businesses
    bind.execute(text('ALTER TABLE IF EXISTS "businesses" ENABLE ROW LEVEL SECURITY'))
    bind.execute(text('DROP POLICY IF EXISTS business_member_access ON "businesses"'))
    bind.execute(
        text(
            """
            CREATE POLICY business_member_access ON "businesses"
            USING (
              id::text = NULLIF(current_setting('app.current_business_id', true), '')
              OR owner_user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
            )
            """
        )
    )
