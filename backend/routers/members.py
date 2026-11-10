"""Athletes and merchants profiles."""

import re
from typing import List, Optional

import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from lib.auth import hash_password, require_role
from lib.db import db
from lib.storage import discard, save_gallery, save_image
from models.schemas import (
    AdminMerchant,
    AdminMerchantSave,
    Athlete,
    AthleteUpdate,
    FamilyMember,
    FamilyMemberIn,
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
    cat = await db.categories.find_one({"id": body.category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    current = await db.athletes.find_one({"user_id": user["id"]}, {"photo": 1}) or {}
    photo = await save_image(body.photo, kind="athletes", owner_user_id=user["id"], public=False, old=current.get("photo"))
    update = {**body.model_dump(), "photo": photo, "category_name": cat["name"],
              "first_name": body.first_name.strip(), "last_name": body.last_name.strip()}
    doc = await db.athletes.find_one_and_update(
        {"user_id": user["id"]}, {"$set": update}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Athlete(**doc, email=user["email"])


@router.get("/athletes", response_model=List[Athlete])
async def list_athletes(q: Optional[str] = None, category_id: Optional[str] = None,
                        _: dict = Depends(require_role("merchant", "admin"))):
    flt: dict = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        flt["$or"] = [{"first_name": rx}, {"last_name": rx}, {"code": rx}]
    if category_id:
        flt["category_id"] = category_id
    docs = await db.athletes.find(flt, ATHLETE_LIST_PROJ).sort([("last_name", 1), ("first_name", 1)]).to_list(2000)
    counts = {
        c["_id"]: c["n"]
        async for c in db.family_members.aggregate([
            {"$match": {"athlete_id": {"$in": [d["id"] for d in docs]}}},
            {"$group": {"_id": "$athlete_id", "n": {"$sum": 1}}},
        ])
    }
    return [Athlete(**d, family_count=counts.get(d["id"], 0)) for d in docs]


@router.get("/athletes/by-code/{code}", response_model=Athlete)
async def athlete_by_code(code: str, _: dict = Depends(require_role("merchant", "admin"))):
    code = code.strip().upper()
    doc = await db.athletes.find_one({"code": code}, {"_id": 0})
    if doc:
        return Athlete(**doc)
    fam = await db.family_members.find_one({"code": code}, {"_id": 0})
    holder = await db.athletes.find_one({"id": fam["athlete_id"]}, {"_id": 0}) if fam else None
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
    logo = await save_image(body.logo, kind="merchants", owner_user_id=uid, public=True)
    gallery = await save_gallery(body.gallery, owner_user_id=uid)
    doc = {**MerchantUpdate(**body.model_dump()).model_dump(), "logo": logo, "gallery": gallery, "published": body.published,
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
    logo = await save_image(body.logo, kind="merchants", owner_user_id=doc["user_id"], public=True, old=doc.get("logo"))
    gallery = await save_gallery(body.gallery, owner_user_id=doc["user_id"], old=doc.get("gallery"))
    update = {**MerchantUpdate(**body.model_dump()).model_dump(), "logo": logo, "gallery": gallery, "published": body.published}
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
    current = await db.merchants.find_one({"user_id": user["id"]}, {"logo": 1, "gallery": 1}) or {}
    logo = await save_image(body.logo, kind="merchants", owner_user_id=user["id"], public=True, old=current.get("logo"))
    gallery = await save_gallery(body.gallery, owner_user_id=user["id"], old=current.get("gallery"))
    doc = await db.merchants.find_one_and_update(
        {"user_id": user["id"]}, {"$set": {**body.model_dump(), "logo": logo, "gallery": gallery}}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Merchant(**doc)
