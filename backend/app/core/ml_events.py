"""Emit domain events into the ML outbox (same DB transaction when possible)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.ml import MlEventModel, new_id


def emit_ml_event(
    db: Session,
    *,
    business_id: str,
    event_type: str,
    payload: dict[str, Any],
    commit: bool = False,
) -> MlEventModel:
    row = MlEventModel(
        id=new_id("mle"),
        business_id=business_id,
        event_type=event_type,
        payload_json=json.dumps(payload, default=str),
        created_at=datetime.utcnow(),
        processed_at=None,
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row
