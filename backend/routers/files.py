"""Serves stored images. Logos are public; athlete photos only to their owner, merchants and admin."""

import asyncio

from fastapi import APIRouter, HTTPException, Request, Response

from lib.auth import current_user
from lib.db import db
from lib.storage import get_object

router = APIRouter(tags=["files"])


@router.get("/files/{id}")
async def get_file(id: str, request: Request):
    rec = await db.files.find_one({"id": id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File non trovato")
    if not rec.get("public"):
        user = await current_user(request)  # 401 when anonymous
        if user["role"] not in ("merchant", "admin") and user["id"] != rec.get("owner_user_id"):
            raise HTTPException(status_code=403, detail="Accesso non consentito")
    try:
        data, _ = await asyncio.to_thread(get_object, rec["storage_path"])
    except Exception:
        raise HTTPException(status_code=502, detail="File temporaneamente non disponibile")
    cache = "public, max-age=31536000, immutable" if rec.get("public") else "private, max-age=86400"
    return Response(content=data, media_type=rec["content_type"], headers={"Cache-Control": cache})
