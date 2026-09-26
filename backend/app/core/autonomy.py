"""Autonomy policy: map tenant mode + model score to drop | suggest | auto."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Mode = Literal["off", "suggest", "automatic"]
Decision = Literal["drop", "suggest", "auto"]


@dataclass(frozen=True)
class AutonomyResult:
    decision: Decision
    reason: str


DEFAULT_T_SUGGEST = 0.70
DEFAULT_T_AUTO = 0.92
DEFAULT_UNIQUE_GAP = 0.15


def decide(
    mode: str,
    score: float,
    *,
    t_suggest: float = DEFAULT_T_SUGGEST,
    t_auto: float = DEFAULT_T_AUTO,
    unique: bool = True,
    guards_pass: bool = True,
    allow_auto_apply: bool = True,
) -> AutonomyResult:
    """
    Decide what the product should do with an ML proposal.

    - Off: never act.
    - Suggest: show for approval when score clears soft threshold.
    - Automatic: apply only when score is high, unique, and guards pass.
      If allow_auto_apply is False (e.g. anomaly flags), Auto becomes Suggest/flag.
    """
    normalized = (mode or "off").strip().lower()
    if normalized in ("fully automatic", "auto", "automatic"):
        normalized = "automatic"
    if normalized in ("suggest-only", "suggest_only", "suggest"):
        normalized = "suggest"
    if normalized not in ("off", "suggest", "automatic"):
        normalized = "off"

    if normalized == "off":
        return AutonomyResult("drop", "Tenant set this feature to Off.")

    if not guards_pass:
        if score >= t_suggest:
            return AutonomyResult("suggest", "Guards failed; showing as suggestion only.")
        return AutonomyResult("drop", "Guards failed and score is below suggest threshold.")

    if normalized == "suggest":
        if score >= t_suggest:
            return AutonomyResult("suggest", "Score cleared suggest threshold.")
        return AutonomyResult("drop", "Score below suggest threshold.")

    # automatic
    if not allow_auto_apply:
        if score >= t_suggest:
            return AutonomyResult(
                "suggest",
                "Automatic mode is flag-only for this feature; creating a review item.",
            )
        return AutonomyResult("drop", "Score below suggest threshold for flag-only Auto.")

    if score >= t_auto and unique:
        return AutonomyResult("auto", "High confidence unique match; applying automatically.")
    if score >= t_suggest:
        return AutonomyResult(
            "suggest",
            "Automatic requested but score/uniqueness requires human approval.",
        )
    return AutonomyResult("drop", "Score below suggest threshold.")


def is_unique_top(top_score: float, second_score: float | None, gap: float = DEFAULT_UNIQUE_GAP) -> bool:
    if second_score is None:
        return True
    return (top_score - second_score) >= gap
