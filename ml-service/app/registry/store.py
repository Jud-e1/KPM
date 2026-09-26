"""Filesystem model registry: registry/{tenant_id}/{model_name}/{version}/."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import joblib

from app.config import settings


def registry_root() -> Path:
    root = Path(settings.REGISTRY_ROOT)
    if not root.is_absolute():
        # resolve relative to ml-service package root
        root = Path(__file__).resolve().parents[2] / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def model_dir(tenant_id: str, model_name: str, version: str) -> Path:
    path = registry_root() / tenant_id / model_name / version
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_artifact(
    tenant_id: str,
    model_name: str,
    version: str,
    model: Any,
    meta: dict[str, Any],
) -> Path:
    d = model_dir(tenant_id, model_name, version)
    joblib.dump(model, d / "model.joblib")
    meta_path = d / "meta.json"
    meta = {**meta, "tenant_id": tenant_id, "model_name": model_name, "version": version}
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return d


def latest_version(tenant_id: str, model_name: str) -> str | None:
    base = registry_root() / tenant_id / model_name
    if not base.exists():
        return None
    versions = sorted([p.name for p in base.iterdir() if p.is_dir()], reverse=True)
    return versions[0] if versions else None


def load_artifact(tenant_id: str, model_name: str, version: str | None = None) -> tuple[Any, dict[str, Any]] | None:
    ver = version or latest_version(tenant_id, model_name)
    if not ver:
        return None
    d = registry_root() / tenant_id / model_name / ver
    model_path = d / "model.joblib"
    meta_path = d / "meta.json"
    if not model_path.exists():
        return None
    model = joblib.load(model_path)
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {"version": ver}
    return model, meta
