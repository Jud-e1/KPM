"""Train + drift jobs: python -m app.jobs

(a) tenants with ≥50 ml_match_links → train recon_ranker
(b) tenants with ≥200 txs → train IsolationForest
(c) write ml_drift_stats (undo rate, score hist, rule hit-rate)
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression

from app import db as tenant_db
from app.features.anomaly_features import build_if_vector
from app.features.recon_features import build_pair_features
from app.registry.store import save_artifact
from app.services.anomaly import IF_MIN_ROWS, train_isolation_forest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("ml.jobs")

RECON_MIN_LINKS = 50
RECON_MODEL = "recon_ranker"


def _tenants() -> list[str]:
    eng = tenant_db.get_engine()
    if eng is None:
        return []
    from sqlalchemy import text

    with eng.connect() as conn:
        rows = conn.execute(text("SELECT DISTINCT business_id AS id FROM accounting_transactions")).fetchall()
        ids = {r[0] for r in rows if r[0]}
        rows2 = conn.execute(text("SELECT DISTINCT business_id AS id FROM ml_match_links")).fetchall()
        ids |= {r[0] for r in rows2 if r[0]}
        rows3 = conn.execute(text("SELECT DISTINCT business_id AS id FROM sales_orders")).fetchall()
        ids |= {r[0] for r in rows3 if r[0]}
        return sorted(ids)


def _execute(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    eng = tenant_db.get_engine()
    if eng is None:
        return []
    from sqlalchemy import text

    with eng.connect() as conn:
        result = conn.execute(text(sql), params or {})
        if result.returns_rows:
            return [dict(r._mapping) for r in result]
        conn.commit()
        return []


def train_recon_ranker(tenant_id: str) -> str | None:
    n = tenant_db.confirmed_match_count(tenant_id)
    if n < RECON_MIN_LINKS:
        logger.info("Skip recon train tenant=%s links=%s (< %s)", tenant_id, n, RECON_MIN_LINKS)
        return None

    links = _execute(
        """
        SELECT payment_id, order_id FROM ml_match_links
        WHERE business_id = :business_id
        ORDER BY created_at DESC LIMIT 500
        """,
        {"business_id": tenant_id},
    )
    X: list[list[float]] = []
    y: list[int] = []
    for link in links:
        tx = tenant_db.get_transaction(tenant_id, str(link["payment_id"]))
        orders = tenant_db.recent_orders(tenant_id, limit=200)
        order = next((o for o in orders if str(o["id"]) == str(link["order_id"])), None)
        if not tx or not order:
            continue
        feats = build_pair_features(tx, order)
        vec = [
            feats["abs_amount_diff"],
            feats["amount_ratio"],
            feats["days_apart"],
            feats["ref_exact"],
            feats["ref_token_overlap"],
            feats["name_similarity"],
        ]
        X.append(vec)
        y.append(1)
        # negatives: other open orders
        for other in orders[:5]:
            if str(other["id"]) == str(order["id"]):
                continue
            of = build_pair_features(tx, other)
            X.append(
                [
                    of["abs_amount_diff"],
                    of["amount_ratio"],
                    of["days_apart"],
                    of["ref_exact"],
                    of["ref_token_overlap"],
                    of["name_similarity"],
                ]
            )
            y.append(0)

    if len(X) < 20 or sum(y) < 5:
        logger.warning("Recon train gate fail tenant=%s samples=%s", tenant_id, len(X))
        return None

    clf = LogisticRegression(max_iter=500)
    clf.fit(np.asarray(X), np.asarray(y))
    version = f"recon-{datetime.utcnow().strftime('%Y%m%d')}"
    save_artifact(
        tenant_id,
        RECON_MODEL,
        version,
        clf,
        {"n_samples": len(X), "positives": int(sum(y)), "algorithm": "LogisticRegression"},
    )
    logger.info("Trained recon_ranker tenant=%s version=%s n=%s", tenant_id, version, len(X))
    return version


def train_anomaly_if(tenant_id: str) -> str | None:
    txs = tenant_db.recent_transactions(tenant_id, limit=500)
    if len(txs) < IF_MIN_ROWS:
        logger.info("Skip IF train tenant=%s txs=%s", tenant_id, len(txs))
        return None
    rows = [build_if_vector(tx, {"amount_median_ratio": 1.0, "new_counterparty": False}) for tx in txs]
    try:
        version = train_isolation_forest(tenant_id, rows, version=f"if-{datetime.utcnow().strftime('%Y%m%d')}")
        logger.info("Trained IsolationForest tenant=%s version=%s", tenant_id, version)
        return version
    except ValueError as exc:
        logger.warning("IF train gate fail tenant=%s: %s", tenant_id, exc)
        return None


def write_drift_stats(tenant_id: str) -> None:
    audits = _execute(
        """
        SELECT action, undone, score, kind FROM ml_audit_actions
        WHERE business_id = :business_id
        ORDER BY created_at DESC LIMIT 500
        """,
        {"business_id": tenant_id},
    )
    total = len(audits) or 1
    undone = sum(1 for a in audits if str(a.get("undone")) == "true")
    undo_rate = undone / total
    scores = [float(a.get("score") or 0) for a in audits]
    hist = Counter(int(min(9, max(0, s * 10))) for s in scores)
    score_hist = {str(k): hist[k] for k in range(10)}
    rules = _execute(
        """
        SELECT COUNT(*) AS c FROM ml_anomaly_flags
        WHERE business_id = :business_id AND rule_ids IS NOT NULL AND rule_ids != ''
        """,
        {"business_id": tenant_id},
    )
    flags_total = _execute(
        "SELECT COUNT(*) AS c FROM ml_anomaly_flags WHERE business_id = :business_id",
        {"business_id": tenant_id},
    )
    ft = int(flags_total[0]["c"]) if flags_total else 0
    rt = int(rules[0]["c"]) if rules else 0
    rule_hit_rate = (rt / ft) if ft else 0.0
    notes = ""
    if undo_rate > 0.25:
        notes = "High undo rate — retrain gate caution."
        logger.warning("Drift gate: high undo_rate=%.2f tenant=%s", undo_rate, tenant_id)

    drift_id = f"mds-{uuid.uuid4().hex[:12]}"
    eng = tenant_db.get_engine()
    if eng is None:
        return
    from sqlalchemy import text

    with eng.begin() as conn:
        # Ensure table exists for sqlite/prod without migration tooling
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS ml_drift_stats (
                    id VARCHAR(64) PRIMARY KEY,
                    business_id VARCHAR(64) NOT NULL,
                    function_id VARCHAR(64) NOT NULL DEFAULT 'all',
                    undo_rate FLOAT NOT NULL DEFAULT 0,
                    score_hist_json TEXT NOT NULL DEFAULT '{}',
                    rule_hit_rate FLOAT NOT NULL DEFAULT 0,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMP NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO ml_drift_stats
                  (id, business_id, function_id, undo_rate, score_hist_json, rule_hit_rate, notes, created_at)
                VALUES
                  (:id, :business_id, 'all', :undo_rate, :score_hist_json, :rule_hit_rate, :notes, :created_at)
                """
            ),
            {
                "id": drift_id,
                "business_id": tenant_id,
                "undo_rate": undo_rate,
                "score_hist_json": json.dumps(score_hist),
                "rule_hit_rate": rule_hit_rate,
                "notes": notes,
                "created_at": datetime.utcnow(),
            },
        )
    logger.info(
        "Wrote drift stats tenant=%s undo_rate=%.3f rule_hit=%.3f",
        tenant_id,
        undo_rate,
        rule_hit_rate,
    )


def run_risk_cards(tenant_id: str) -> None:
    from app.core_client import post_proposal
    from app.services.risk import build_risk_proposal, score_customer, score_supplier

    orders = tenant_db.recent_orders(tenant_id, limit=300)
    txs = tenant_db.recent_transactions(tenant_id, limit=300)
    reqs = tenant_db.list_supplier_requests(tenant_id)
    n = 0
    for c in tenant_db.list_customers(tenant_id):
        card = score_customer(c, orders=orders, transactions=txs)
        if card["score"] >= 0.4:
            post_proposal(build_risk_proposal(tenant_id, card))
            n += 1
    for s in tenant_db.list_suppliers(tenant_id):
        card = score_supplier(s, requests=reqs, transactions=txs)
        if card["score"] >= 0.4:
            post_proposal(build_risk_proposal(tenant_id, card))
            n += 1
    logger.info("Posted %s risk proposals for tenant=%s", n, tenant_id)


def run_all() -> None:
    tenants = _tenants()
    logger.info("Jobs starting for %s tenants", len(tenants))
    for tid in tenants:
        try:
            train_recon_ranker(tid)
            train_anomaly_if(tid)
            write_drift_stats(tid)
            run_risk_cards(tid)
        except Exception:
            logger.exception("Job failed for tenant %s", tid)
    logger.info("Jobs complete")


if __name__ == "__main__":
    run_all()
