"""Pair features for payment ↔ open order reconciliation."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any


def _tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 1}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00").split("+")[0])
    except Exception:
        return None


@dataclass
class PairFeatures:
    abs_amount_diff: float
    amount_ratio: float
    days_apart: float
    ref_exact: float
    ref_token_overlap: float
    name_similarity: float

    def as_dict(self) -> dict[str, float]:
        return {
            "abs_amount_diff": self.abs_amount_diff,
            "amount_ratio": self.amount_ratio,
            "days_apart": self.days_apart,
            "ref_exact": self.ref_exact,
            "ref_token_overlap": self.ref_token_overlap,
            "name_similarity": self.name_similarity,
        }

    def as_vector(self) -> list[float]:
        d = self.as_dict()
        return [
            d["abs_amount_diff"],
            d["amount_ratio"],
            d["days_apart"],
            d["ref_exact"],
            d["ref_token_overlap"],
            d["name_similarity"],
        ]


def build_pair_features(payment: dict[str, Any], order: dict[str, Any]) -> PairFeatures:
    p_amt = abs(float(payment.get("amount") or 0))
    o_amt = abs(float(order.get("total_amount") or 0))
    abs_diff = abs(p_amt - o_amt)
    ratio = (min(p_amt, o_amt) / max(p_amt, o_amt)) if max(p_amt, o_amt) > 0 else 0.0

    p_dt = _parse_dt(payment.get("transaction_date") or payment.get("created_at"))
    o_dt = _parse_dt(order.get("order_date") or order.get("created_at"))
    if p_dt and o_dt:
        days = abs((p_dt.date() - o_dt.date()).days)
    else:
        days = 999.0

    ref = (payment.get("reference") or "") + " " + (payment.get("description") or "")
    order_num = (order.get("order_number") or "").lower()
    ref_l = ref.lower()
    ref_exact = 1.0 if order_num and order_num in ref_l else 0.0
    ref_overlap = _jaccard(_tokens(ref), _tokens(order.get("order_number")))
    name_sim = _jaccard(_tokens(payment.get("counterparty")), _tokens(order.get("customer_name")))

    return PairFeatures(
        abs_amount_diff=abs_diff,
        amount_ratio=ratio,
        days_apart=float(days),
        ref_exact=ref_exact,
        ref_token_overlap=ref_overlap,
        name_similarity=name_sim,
    )
