"""Account completion columns and invite tokens.

Revision ID: 002_account_completion
Revises: 001_multi_tenant
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.core.database import Base
import app.models  # noqa: F401

revision: str = "002_account_completion"
down_revision: Union[str, None] = "001_multi_tenant"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" in tables:
        cols = {column["name"] for column in inspector.get_columns("users")}
        if "email_verified" not in cols:
            op.add_column(
                "users",
                sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
            )
    if "businesses" in tables:
        cols = {column["name"] for column in inspector.get_columns("businesses")}
        if "plan" not in cols:
            op.add_column(
                "businesses",
                sa.Column("plan", sa.String(length=40), nullable=False, server_default="free"),
            )
        if "stripe_customer_id" not in cols:
            op.add_column("businesses", sa.Column("stripe_customer_id", sa.String(length=80), nullable=True))
        if "stripe_subscription_id" not in cols:
            op.add_column("businesses", sa.Column("stripe_subscription_id", sa.String(length=80), nullable=True))
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "business_invites" in tables:
        op.drop_table("business_invites")
    if "auth_tokens" in tables:
        op.drop_table("auth_tokens")
