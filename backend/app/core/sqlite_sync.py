"""Share the Vercel SQLite file through Blob so every instance sees the same data."""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

PATHNAME = "kpm_app.db"
LOCAL_PATH = "/tmp/kpm_app.db"
_API = "https://vercel.com/api/blob"
_API_VERSION = "12"
_DEFAULT_STORE_ID = "A2tt90wfY8njLoaK"


def enabled() -> bool:
    return bool(os.environ.get("VERCEL") and os.environ.get("BLOB_READ_WRITE_TOKEN"))


def _store_id() -> str:
    explicit = os.environ.get("BLOB_STORE_ID", "").strip()
    if explicit:
        return explicit.removeprefix("store_")
    parts = os.environ.get("BLOB_READ_WRITE_TOKEN", "").split("_")
    if len(parts) >= 4 and parts[0] == "vercel":
        return parts[3]
    return _DEFAULT_STORE_ID


def _headers(content_type: str | None = None, content_length: int | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {os.environ['BLOB_READ_WRITE_TOKEN']}",
        "x-api-version": _API_VERSION,
        "x-vercel-blob-access": "private",
        "x-add-random-suffix": "0",
    }
    store_id = _store_id()
    if store_id:
        headers["x-vercel-blob-store-id"] = store_id
    if content_type:
        headers["x-content-type"] = content_type
    if content_length is not None:
        headers["x-content-length"] = str(content_length)
    return headers


def _error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8", errors="replace")[:300]
    except Exception:
        raw = ""
    return f"HTTP {exc.code} {raw}".strip()


def _read_json(req: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(_error_detail(exc)) from exc


def _stamp(meta: dict) -> str:
    return str(meta.get("etag") or meta.get("uploadedAt") or "")


def stat_remote() -> dict | None:
    if not enabled():
        return None
    query = urllib.parse.urlencode({"prefix": PATHNAME, "limit": "10"})
    req = urllib.request.Request(f"{_API}?{query}", headers=_headers(), method="GET")
    try:
        payload = _read_json(req)
    except RuntimeError as exc:
        logger.warning("Blob list failed: %s", exc)
        return None
    blobs = payload.get("blobs") or []
    return next((blob for blob in blobs if blob.get("pathname") == PATHNAME), None)


def remote_stamp() -> str | None:
    meta = stat_remote()
    if not meta:
        return None
    stamp = _stamp(meta)
    return stamp or None


def pull(local_path: str = LOCAL_PATH) -> str | None:
    meta = stat_remote()
    if not meta:
        return None
    blob_url = meta.get("url")
    if not blob_url:
        store_id = _store_id()
        if not store_id:
            return None
        blob_url = f"https://{store_id}.private.blob.vercel-storage.com/{PATHNAME}"
    download = urllib.parse.urlparse(blob_url)
    query = urllib.parse.parse_qs(download.query)
    query["cache"] = ["0"]
    fresh = download._replace(query=urllib.parse.urlencode(query, doseq=True)).geturl()
    req = urllib.request.Request(fresh, headers={"Authorization": f"Bearer {os.environ['BLOB_READ_WRITE_TOKEN']}"}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = res.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(_error_detail(exc)) from exc
    directory = os.path.dirname(local_path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    temporary = local_path + ".download"
    with open(temporary, "wb") as handle:
        handle.write(data)
    os.replace(temporary, local_path)
    stamp = _stamp(meta)
    return stamp or None


def push(local_path: str = LOCAL_PATH) -> str | None:
    if not enabled() or not os.path.exists(local_path):
        return None
    with open(local_path, "rb") as handle:
        data = handle.read()
    query = urllib.parse.urlencode({"pathname": PATHNAME})
    headers = _headers("application/octet-stream", len(data))
    headers["x-allow-overwrite"] = "1"
    req = urllib.request.Request(f"{_API}?{query}", data=data, headers=headers, method="PUT")
    payload = _read_json(req)
    stamp = _stamp(payload)
    return stamp or remote_stamp()
