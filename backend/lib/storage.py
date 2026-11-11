"""Image storage: a server folder when UPLOAD_DIR is set, otherwise Emergent managed object storage for images (athlete photos, merchant/association logos).

Clients still send images as data URLs; `save_image` uploads them and returns a stable
`/api/files/{id}` reference that <img> tags load through our backend (cookie auth).
"""

import asyncio
import base64
import binascii
import logging
import os
import re
import mimetypes
import uuid
from pathlib import Path
from typing import Optional

import requests
from fastapi import HTTPException

from lib.db import db
from models.schemas import now_utc

logger = logging.getLogger(__name__)

# `or`, not a default= argument: the platform sets this to "" when it has no value.
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "noi-di-leyni"
MAX_BYTES = 1_500_000
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
DATA_URL = re.compile(r"^data:(image/(?:jpeg|jpg|png|webp|gif));base64,(.+)$", re.S)
FILE_REF = "/api/files/"

# Own storage: when UPLOAD_DIR is set (Render disk, Hostinger, VPS…) files live in that server folder.
UPLOAD_DIR = (os.environ.get("UPLOAD_DIR") or "").strip()

_storage_key: Optional[str] = None


def _local_path(path: str) -> Path:
    base = Path(UPLOAD_DIR).resolve()
    target = (base / path).resolve()
    if base not in target.parents:
        raise ValueError("invalid storage path")
    return target


def init_storage(force: bool = False) -> str:
    global _storage_key
    if UPLOAD_DIR:
        Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        return "local"
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, path: str, **kw) -> requests.Response:
    for attempt in (0, 1):
        key = init_storage(force=attempt == 1)
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, **kw.pop("headers", {})}, **kw)
        if resp.status_code == 404 and attempt == 0 and method == "PUT":
            continue  # stale storage key: re-init once
        resp.raise_for_status()
        return resp
    raise RuntimeError("unreachable")


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if UPLOAD_DIR:
        target = _local_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return {"path": path, "size": len(data)}
    return _request("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120).json()


def get_object(path: str) -> tuple[bytes, str]:
    if UPLOAD_DIR and _local_path(path).is_file():
        return _local_path(path).read_bytes(), mimetypes.guess_type(path)[0] or "application/octet-stream"
    resp = _request("GET", path, timeout=60)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def save_image(value: Optional[str], *, kind: str, owner_user_id: Optional[str], public: bool,
                     old: Optional[str] = None) -> Optional[str]:
    """Upload a data-URL image and return its /api/files ref; pass through refs/URLs/None.
    Soft-deletes the previous stored file when it is replaced or removed."""
    new = value
    if value and value.startswith("data:"):
        m = DATA_URL.match(value)
        if not m:
            raise HTTPException(status_code=400, detail="Formato immagine non supportato")
        ctype = "image/jpeg" if m.group(1) == "image/jpg" else m.group(1)
        try:
            data = base64.b64decode(m.group(2), validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail="Immagine non valida")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Immagine troppo grande (max 1,5 MB)")
        fid = str(uuid.uuid4())
        path = f"{APP_NAME}/{kind}/{owner_user_id or 'club'}/{fid}.{EXT[ctype]}"
        try:
            result = await asyncio.to_thread(put_object, path, data, ctype)
        except Exception as e:  # noqa: BLE001
            logger.error("storage upload failed: %s", e)
            raise HTTPException(status_code=502, detail="Caricamento immagine non riuscito, riprova")
        await db.files.insert_one({
            "id": fid, "storage_path": result["path"], "content_type": ctype, "size": result.get("size", len(data)),
            "kind": kind, "owner_user_id": owner_user_id, "public": public, "is_deleted": False, "created_at": now_utc(),
        })
        new = f"{FILE_REF}{fid}"
    elif value and not (value.startswith(FILE_REF) or value.startswith("https://")):
        raise HTTPException(status_code=400, detail="Immagine non valida")
    if old and old != new:
        await discard(old)
    return new


async def discard(ref: Optional[str]) -> None:
    """Soft-delete a stored file (storage has no delete API)."""
    if ref and ref.startswith(FILE_REF):
        await db.files.update_one({"id": ref[len(FILE_REF):]}, {"$set": {"is_deleted": True, "deleted_at": now_utc()}})


async def save_gallery(items: list[str], *, owner_user_id: str, old: Optional[list[str]] = None) -> list[str]:
    out = [await save_image(v, kind="gallery", owner_user_id=owner_user_id, public=True) for v in items if v]
    for ref in old or []:
        if ref not in out:
            await discard(ref)
    return [r for r in out if r]
