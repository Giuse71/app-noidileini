"""Single club invite link (/invito): visit counter + sign-ups that came through it."""
from fastapi import APIRouter, Depends

from lib.auth import require_role
from lib.db import db
from models.schemas import InviteStats

router = APIRouter()


@router.post("/invite/visit")
async def invite_visit():
    await db.invite_stats.update_one({"_id": "club"}, {"$inc": {"visits": 1}}, upsert=True)
    return {"ok": True}


@router.get("/admin/invite", response_model=InviteStats, dependencies=[Depends(require_role("admin"))])
async def invite_stats():
    doc = await db.invite_stats.find_one({"_id": "club"}) or {}
    athletes = await db.users.count_documents({"via_invite": True, "role": "athlete"})
    merchants = await db.users.count_documents({"via_invite": True, "role": "merchant"})
    return InviteStats(visits=doc.get("visits", 0), athletes=athletes, merchants=merchants)
