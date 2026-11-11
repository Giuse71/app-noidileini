"""Board-managed content: club news for athletes, home event photo strip, upload limits, email test."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib import email as mail
from lib.auth import require_role
from lib.db import db
from lib.storage import BOARD_MAX_MB, MEMBER_MAX_MB, discard, save_image
from models.schemas import now_utc
from models.board_content import (
    ClubNews, ClubNewsIn, EmailStatus, EmailTestIn, EmailTestResult, EventPhoto, EventPhotoIn, UploadLimits,
)

router = APIRouter(tags=["board-content"])
admin_only = require_role("admin")
EVENT_PHOTOS_SHOWN = 12
LIVE = {"is_deleted": {"$ne": True}}  # soft delete: removed items stay in the database


@router.get("/upload-limits", response_model=UploadLimits)
async def upload_limits():
    return UploadLimits(member_mb=MEMBER_MAX_MB, board_mb=BOARD_MAX_MB)


# ---------- news (athletes + board) ----------
@router.get("/news", response_model=List[ClubNews], dependencies=[Depends(require_role("athlete", "admin"))])
async def list_news():
    return await db.news.find(LIVE, {"_id": 0}).sort("created_at", -1).to_list(20)


@router.post("/admin/news", response_model=ClubNews, dependencies=[Depends(admin_only)])
async def create_news(body: ClubNewsIn):
    item = ClubNews(title=body.title.strip(), body=body.body.strip())
    await db.news.insert_one(item.model_dump())
    return item


@router.delete("/admin/news/{id}", dependencies=[Depends(admin_only)])
async def delete_news(id: str):
    res = await db.news.update_one({"id": id, **LIVE}, {"$set": {"is_deleted": True, "deleted_at": now_utc()}})
    if not res.modified_count:
        raise HTTPException(status_code=404, detail="Notizia non trovata")
    return {"ok": True}


# ---------- home event photos (public) ----------
@router.get("/event-photos", response_model=List[EventPhoto])
async def list_event_photos():
    return await db.event_photos.find(LIVE, {"_id": 0}).sort("created_at", -1).to_list(EVENT_PHOTOS_SHOWN)


@router.get("/admin/event-photos", response_model=List[EventPhoto], dependencies=[Depends(admin_only)])
async def admin_event_photos():
    return await db.event_photos.find(LIVE, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/event-photos", response_model=EventPhoto, dependencies=[Depends(admin_only)])
async def add_event_photo(body: EventPhotoIn):
    ref = await save_image(body.image, kind="events", owner_user_id=None, public=True, board=True)
    if not ref:
        raise HTTPException(status_code=400, detail="Immagine mancante")
    item = EventPhoto(image=ref, caption=body.caption.strip())
    await db.event_photos.insert_one(item.model_dump())
    return item


@router.delete("/admin/event-photos/{id}", dependencies=[Depends(admin_only)])
async def delete_event_photo(id: str):
    doc = await db.event_photos.find_one({"id": id, **LIVE}, {"_id": 0, "image": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Foto non trovata")
    await db.event_photos.update_one({"id": id}, {"$set": {"is_deleted": True, "deleted_at": now_utc()}})
    await discard(doc.get("image"))
    return {"ok": True}


# ---------- email provider ----------
@router.get("/admin/email/status", response_model=EmailStatus, dependencies=[Depends(admin_only)])
async def email_status():
    if mail.gmail_enabled():
        return EmailStatus(provider="gmail", sender=mail.GMAIL_USER)
    return EmailStatus(provider="emergent")


@router.post("/admin/email/test", response_model=EmailTestResult, dependencies=[Depends(admin_only)])
async def email_test(body: EmailTestIn):
    provider = "gmail" if mail.gmail_enabled() else "emergent"
    html = (
        "<div style='font-family:Arial,sans-serif;color:#1e3a8a'>"
        "<h2>Email di prova · App Noi di Leyni</h2>"
        "<p>Se leggi questo messaggio, l'invio email dell'app funziona correttamente.</p>"
        f"<p style='color:#64748b;font-size:12px'>Inviata tramite: {'Gmail' if provider == 'gmail' else 'Emergent'}</p>"
        "</div>"
    )
    try:
        await mail.send_email(to=[str(body.to)], subject="Prova invio email · Leinì Volley", html=html,
                              gmail_only=provider == "gmail")
    except mail.EmailError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return EmailTestResult(ok=True, provider=provider)
