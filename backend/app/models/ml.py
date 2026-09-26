from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


def new_id(_prefix: str = "") -> object:
    """Allocate a UUID primary key (prefix kept for call-site compatibility)."""
    return new_uuid()


class MlEventModel(Base):
    __tablename__ = "ml_events"
    __table_args__ = (Index("ix_ml_events_unprocessed", "business_id", "processed_at"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(80), nullable=False, index=True)
    payload_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), nullable=True, index=True)


class MlProposalModel(Base):
    __tablename__ = "ml_proposals"
    __table_args__ = (Index("ix_ml_proposals_business_status", "business_id", "status"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(40), nullable=False, index=True)
    function_id = Column(String(64), nullable=False, index=True)
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(64), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0)
    unique_top = Column(String(8), nullable=False, default="true")
    model_version = Column(String(80), nullable=False, default="rules-v1")
    explanation = Column(Text, nullable=False, default="")
    payload_json = Column(Text, nullable=False, default="{}")
    status = Column(String(30), nullable=False, default="pending", index=True)
    decision = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class MlAuditActionModel(Base):
    __tablename__ = "ml_audit_actions"
    __table_args__ = (Index("ix_ml_audit_business", "business_id"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_id = Column(GUID(), nullable=True, index=True)
    kind = Column(String(40), nullable=False, index=True)
    action = Column(String(40), nullable=False)
    model_version = Column(String(80), nullable=False, default="rules-v1")
    score = Column(Float, nullable=False, default=0.0)
    explanation = Column(Text, nullable=False, default="")
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(64), nullable=False)
    undo_payload = Column(Text, nullable=False, default="{}")
    undone = Column(String(8), nullable=False, default="false")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MlMatchLinkModel(Base):
    __tablename__ = "ml_match_links"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_id = Column(String(64), nullable=False, unique=True, index=True)
    order_id = Column(GUID(), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0)
    model_version = Column(String(80), nullable=False, default="rules-v1")
    audit_id = Column(GUID(), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MlAnomalyFlagModel(Base):
    __tablename__ = "ml_anomaly_flags"
    __table_args__ = (Index("ix_ml_anomaly_business_status", "business_id", "status"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(64), nullable=False, index=True)
    rule_ids = Column(String(255), nullable=False, default="")
    score = Column(Float, nullable=False, default=0.0)
    severity = Column(String(20), nullable=False, default="soft")
    explanation = Column(Text, nullable=False, default="")
    model_version = Column(String(80), nullable=False, default="rules-v1")
    status = Column(String(30), nullable=False, default="open", index=True)
    audit_id = Column(GUID(), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MlDriftStatsModel(Base):
    __tablename__ = "ml_drift_stats"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    function_id = Column(String(64), nullable=False, default="all")
    undo_rate = Column(Float, nullable=False, default=0.0)
    score_hist_json = Column(Text, nullable=False, default="{}")
    rule_hit_rate = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MlRiskScoreModel(Base):
    __tablename__ = "ml_risk_scores"
    __table_args__ = (
        Index("ix_ml_risk_business_partner", "business_id", "partner_type", "partner_id"),
        UniqueConstraint("business_id", "partner_type", "partner_id", name="uq_ml_risk_partner"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    partner_type = Column(String(40), nullable=False)
    partner_id = Column(String(64), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0)
    band = Column(String(20), nullable=False, default="low")
    explanation = Column(Text, nullable=False, default="")
    factors_json = Column(Text, nullable=False, default="{}")
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
