"""Athletes and merchants profiles."""

import re
from typing import List, Literal, Optional

import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from lib.auth import hash_password, require_role
from lib.categories import resolve_category
from lib.db import db
from lib.storage import discard, save_gallery, save_image
from lib.geocode import geocode, resolve_coords
from models.schemas import (
    AthleteStatusIn,
    AdminMerchant,
    AdminMerchantSave,
    Athlete,
    AthleteUpdate,
    FamilyMember,
    FamilyMemberIn,
    GeocodeOut,
    Merchant,
    MerchantUpdate,
    new_id,
    now_utc,
)
from routers.auth import new_athlete_code
from routers.notify import announce_merchant, public_base

router = APIRouter(tags=["members"])
ATHLETE_LIST_PROJ = {"_id": 0}


# ---------- athletes ----------
@router.get("/athletes/me", response_model=Athlete)
async def my_athlete(user: dict = Depends(require_role("athlete"))):
    doc = await db.athletes.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Athlete(**doc, email=user["email"])


@router.put("/athletes/me", response_model=Athlete)
async def update_my_athlete(body: AthleteUpdate, user: dict = Depends(require_role("athlete"))):
    cat_id, cat_name = await resolve_category(body.category_id, body.category_custom)
    current = await db.athletes.find_one({"user_id": user["id"]}, {"photo": 1}) or {}
    photo = await save_image(body.photo, kind="athletes", owner_user_id=user["id"], public=False, old=current.get("photo"))
    update = {**body.model_dump(exclude={"category_custom"}), "photo": photo, "category_id": cat_id,
              "category_name": cat_name, "team_role": " ".join(body.team_role.split()),
              "first_name": body.first_name.strip(), "last_name": body.last_name.strip()}
    doc = await db.athletes.find_one_and_update(
        {"user_id": user["id"]}, {"$set": update}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Athlete(**doc, email=user["email"])


def _exact_ci(value: str) -> dict:
    return {"$regex": f"^{re.escape(' '.join(value.split()))}$", "$options": "i"}


@router.get("/athletes", response_model=List[Athlete])
async def list_athletes(q: Optional[str] = None, category_id: Optional[str] = None,
                        category: Optional[str] = None, role: Optional[str] = None,
                        status: Literal["active", "inactive", "all"] = "active",
                        user: dict = Depends(require_role("merchant", "admin"))):
    flt: dict = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        flt["$or"] = [{"first_name": rx}, {"last_name": rx}, {"code": rx}]
    if category_id:
        flt["category_id"] = category_id
    if category:  # by name: covers both club and typed categories
        flt["category_name"] = _exact_ci(category)
    if role:
        flt["team_role"] = _exact_ci(role) if role != "__none" else {"$in": ["", None]}
    # merchants only ever see active cards
    if user["role"] != "admin" or status == "active":
        flt["is_active"] = {"$ne": False}
    elif status == "inactive":
        flt["is_active"] = False
    docs = await db.athletes.find(flt, ATHLETE_LIST_PROJ).sort([("last_name", 1), ("first_name", 1)]).to_list(2000)
    emails: dict = {}
    if user["role"] == "admin":
        emails = {u["id"]: u["email"] async for u in db.users.find({"id": {"$in": [d["user_id"] for d in docs if d.get("user_id")]}}, {"_id": 0, "id": 1, "email": 1})}
    counts = {
        c["_id"]: c["n"]
        async for c in db.family_members.aggregate([
            {"$match": {"athlete_id": {"$in": [d["id"] for d in docs]}}},
            {"$group": {"_id": "$athlete_id", "n": {"$sum": 1}}},
        ])
    }
    return [Athlete(**{**d, "email": emails.get(d.get("user_id"), "")}, family_count=counts.get(d["id"], 0)) for d in docs]


@router.patch("/admin/athletes/{id}/status", response_model=Athlete)
async def set_athlete_status(id: str, body: AthleteStatusIn, _: dict = Depends(require_role("admin"))):
    """Soft deactivate/reactivate: blocks login and the card at the till, keeps all history."""
    doc = await db.athletes.find_one_and_update(
        {"id": id}, {"$set": {"is_active": body.active, "deactivated_at": None if body.active else now_utc()}},
        projection={"_id": 0}, return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"is_active": body.active}})
    return Athlete(**doc)


@router.get("/athletes/by-code/{code}", response_model=Athlete)
async def athlete_by_code(code: str, _: dict = Depends(require_role("merchant", "admin"))):
    code = code.strip().upper()
    doc = await db.athletes.find_one({"code": code}, {"_id": 0})
    if doc:
        if doc.get("is_active") is False:
            raise HTTPException(status_code=404, detail="Tessera disattivata dal direttivo")
        return Athlete(**doc)
    fam = await db.family_members.find_one({"code": code}, {"_id": 0})
    holder = await db.athletes.find_one({"id": fam["athlete_id"]}, {"_id": 0}) if fam else None
    if holder and holder.get("is_active") is False:
        raise HTTPException(status_code=404, detail="Tessera disattivata dal direttivo")
    if not fam or not holder:
        raise HTTPException(status_code=404, detail="Nessun atleta con questo codice")
    return Athlete(
        **{**holder, "first_name": fam["first_name"], "last_name": fam["last_name"], "photo": fam.get("photo"), "code": fam["code"]},
        is_family=True, family_member_id=fam["id"], relation=fam.get("relation", ""),
        holder_name=f'{holder["first_name"]} {holder["last_name"]}',
    )


# ---------- family members (owned by the logged-in athlete) ----------
async def _my_athlete_id(user: dict) -> str:
    doc = await db.athletes.find_one({"user_id": user["id"]}, {"id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return doc["id"]


@router.get("/athletes/me/family", response_model=List[FamilyMember])
async def my_family(user: dict = Depends(require_role("athlete"))):
    aid = await _my_athlete_id(user)
    return await db.family_members.find({"athlete_id": aid}, {"_id": 0}).sort("created_at", 1).to_list(500)


@router.post("/athletes/me/family", response_model=FamilyMember)
async def add_family(body: FamilyMemberIn, user: dict = Depends(require_role("athlete"))):
    aid = await _my_athlete_id(user)
    photo = await save_image(body.photo, kind="family", owner_user_id=user["id"], public=False)
    fm = FamilyMember(
        id=new_id(), code=await new_athlete_code(), created_at=now_utc(), photo=photo,
        first_name=body.first_name.strip(), last_name=body.last_name.strip(), relation=body.relation.strip(),
    )
    await db.family_members.insert_one({**fm.model_dump(), "athlete_id": aid})
    return fm


@router.put("/athletes/me/family/{id}", response_model=FamilyMember)
async def update_family(id: str, body: FamilyMemberIn, user: dict = Depends(require_role("athlete"))):
    aid = await _my_athlete_id(user)
    current = await db.family_members.find_one({"id": id, "athlete_id": aid}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Familiare non trovato")
    photo = await save_image(body.photo, kind="family", owner_user_id=user["id"], public=False, old=current.get("photo"))
    update = {"first_name": body.first_name.strip(), "last_name": body.last_name.strip(),
              "relation": body.relation.strip(), "photo": photo}
    doc = await db.family_members.find_one_and_update({"id": id, "athlete_id": aid}, {"$set": update},
                                                      projection={"_id": 0}, return_document=True)
    return FamilyMember(**doc)


@router.delete("/athletes/me/family/{id}")
async def remove_family(id: str, user: dict = Depends(require_role("athlete"))):
    aid = await _my_athlete_id(user)
    doc = await db.family_members.find_one_and_delete({"id": id, "athlete_id": aid})
    if not doc:
        raise HTTPException(status_code=404, detail="Familiare non trovato")
    await discard(doc.get("photo"))
    return {"ok": True}


# ---------- merchants ----------
@router.get("/merchants", response_model=List[Merchant])
async def list_merchants():
    docs = await db.merchants.find({"published": {"$ne": False}}, {"_id": 0}).sort("business_name", 1).to_list(1000)
    return [Merchant(**d) for d in docs]


@router.get("/geocode", response_model=GeocodeOut, dependencies=[Depends(require_role("merchant", "admin"))])
async def geocode_address(address: str, city: str = "Leinì"):
    coords = await geocode(address, city)
    return GeocodeOut(found=bool(coords), lat=coords[0] if coords else None, lng=coords[1] if coords else None)


# ---------- admin: merchant slots ----------
async def _admin_merchant(doc: dict) -> AdminMerchant:
    user = await db.users.find_one({"id": doc["user_id"]}, {"email": 1})
    return AdminMerchant(**doc, account_email=user["email"] if user else "")


@router.get("/admin/merchants", response_model=List[AdminMerchant], dependencies=[Depends(require_role("admin"))])
async def admin_list_merchants():
    docs = await db.merchants.find({}, {"_id": 0}).sort("business_name", 1).to_list(1000)
    return [await _admin_merchant(d) for d in docs]


@router.post("/admin/merchants", response_model=AdminMerchant, dependencies=[Depends(require_role("admin"))])
async def admin_create_merchant(body: AdminMerchantSave, request: Request, background: BackgroundTasks):
    email = body.account_email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email già registrata")
    uid = new_id()
    # without a password the merchant sets one through the invitation link
    password = body.new_password or secrets.token_urlsafe(24)
    await db.users.insert_one({"id": uid, "email": email, "password_hash": hash_password(password),
                               "role": "merchant", "created_at": now_utc()})
    logo = await save_image(body.logo, kind="merchants", owner_user_id=uid, public=True, board=True)
    gallery = await save_gallery(body.gallery, owner_user_id=uid, board=True)
    profile = await resolve_coords({**MerchantUpdate(**body.model_dump()).model_dump(), "logo": logo, "gallery": gallery}, None)
    doc = {**profile, "published": body.published,
           "id": new_id(), "user_id": uid, "created_at": now_utc()}
    await db.merchants.insert_one(dict(doc))
    if body.published:
        background.add_task(announce_merchant, doc["id"], public_base(request))
    return await _admin_merchant(doc)


@router.put("/admin/merchants/{id}", response_model=AdminMerchant, dependencies=[Depends(require_role("admin"))])
async def admin_update_merchant(id: str, body: AdminMerchantSave, request: Request, background: BackgroundTasks):
    doc = await db.merchants.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Commerciante non trovato")
    email = body.account_email.lower()
    clash = await db.users.find_one({"email": email, "id": {"$ne": doc["user_id"]}})
    if clash:
        raise HTTPException(status_code=409, detail="Email già usata da un altro account")
    user_set: dict = {"email": email}
    if body.new_password:
        user_set["password_hash"] = hash_password(body.new_password)
    await db.users.update_one({"id": doc["user_id"]}, {"$set": user_set})
    logo = await save_image(body.logo, kind="merchants", owner_user_id=doc["user_id"], public=True, old=doc.get("logo"), board=True)
    gallery = await save_gallery(body.gallery, owner_user_id=doc["user_id"], old=doc.get("gallery"), board=True)
    update = await resolve_coords(
        {**MerchantUpdate(**body.model_dump()).model_dump(), "logo": logo, "gallery": gallery, "published": body.published}, doc)
    doc = await db.merchants.find_one_and_update({"id": id}, {"$set": update}, projection={"_id": 0}, return_document=True)
    if body.published and not doc.get("announced_at"):
        background.add_task(announce_merchant, id, public_base(request))
    return await _admin_merchant(doc)


@router.get("/merchants/me", response_model=Merchant)
async def my_merchant(user: dict = Depends(require_role("merchant"))):
    doc = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Merchant(**doc)


@router.put("/merchants/me", response_model=Merchant)
async def update_my_merchant(body: MerchantUpdate, user: dict = Depends(require_role("merchant"))):
    current = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    logo = await save_image(body.logo, kind="merchants", owner_user_id=user["id"], public=True, old=current.get("logo"))
    gallery = await save_gallery(body.gallery, owner_user_id=user["id"], old=current.get("gallery"))
    doc = await db.merchants.find_one_and_update(
        {"user_id": user["id"]}, {"$set": await resolve_coords({**body.model_dump(), "logo": logo, "gallery": gallery}, current or None)}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Merchant(**doc)
