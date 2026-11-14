"""Supervisor (super-admin): full control over every account and the board's permissions.

Only the supervisor can change board areas or block board members and merchants; board members can
never edit or remove the supervisor. Every change is written to db.audit_log.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import AREAS, is_super, require_super, user_areas
from lib.db import db
from models.schemas import AccountOut, AuditEntry, PermissionsIn, UserStatusIn, now_utc

router = APIRouter(prefix="/admin/supervisor", tags=["supervisor"])


from lib.audit import audit as _audit  # noqa: E402


@router.get("/audit", response_model=List[AuditEntry])
async def audit_feed(_: dict = Depends(require_super)):
    return await db.audit_log.find({}, {"_id": 0}).sort("at", -1).to_list(300)


async def _account(u: dict) -> AccountOut:
    name = ""
    if u["role"] == "merchant":
        m = await db.merchants.find_one({"user_id": u["id"]}, {"business_name": 1})
        name = (m or {}).get("business_name", "")
    elif u["role"] == "athlete":
        a = await db.athletes.find_one({"user_id": u["id"]}, {"first_name": 1, "last_name": 1})
        name = f'{(a or {}).get("first_name", "")} {(a or {}).get("last_name", "")}'.strip()
    return AccountOut(id=u["id"], email=u["email"], role=u["role"], name=name, is_active=u.get("is_active") is not False,
                      is_superadmin=is_super(u), areas=user_areas(u), created_at=u.get("created_at"))


@router.get("/accounts", response_model=List[AccountOut])
async def accounts(role: str = "admin", _: dict = Depends(require_super)):
    if role not in ("admin", "merchant", "athlete"):
        raise HTTPException(status_code=400, detail="Ruolo non valido")
    docs = await db.users.find({"role": role}, {"_id": 0, "password_hash": 0}).sort("email", 1).to_list(5000)
    return [await _account(u) for u in docs]


@router.put("/accounts/{id}/permissions", response_model=AccountOut)
async def set_permissions(id: str, body: PermissionsIn, me: dict = Depends(require_super)):
    target = await db.users.find_one({"id": id, "role": "admin"}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Membro del Direttivo non trovato")
    if is_super(target):
        raise HTTPException(status_code=400, detail="Il supervisore ha sempre accesso a tutto")
    areas = [a for a in AREAS if a in body.areas]
    await db.users.update_one({"id": id}, {"$set": {"permissions": areas}})
    await _audit(me, "permissions", target, {"areas": areas})
    return await _account({**target, "permissions": areas})


@router.patch("/accounts/{id}/status", response_model=AccountOut)
async def set_status(id: str, body: UserStatusIn, me: dict = Depends(require_super)):
    target = await db.users.find_one({"id": id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Account non trovato")
    if is_super(target):
        raise HTTPException(status_code=400, detail="Non puoi bloccare il supervisore")
    await db.users.update_one({"id": id}, {"$set": {"is_active": body.active}})
    if target["role"] == "athlete":
        await db.athletes.update_one({"user_id": id}, {"$set": {"is_active": body.active, "deactivated_at": None if body.active else now_utc()}})
    await _audit(me, "status", target, {"active": body.active})
    return await _account({**target, "is_active": body.active})
