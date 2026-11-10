"""Athletes and merchants profiles."""

import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_role
from lib.db import db
from models.schemas import Athlete, AthleteUpdate, Merchant, MerchantUpdate

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
    update = {**body.model_dump(), "category_name": cat["name"],
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
    return [Athlete(**d) for d in docs]


@router.get("/athletes/by-code/{code}", response_model=Athlete)
async def athlete_by_code(code: str, _: dict = Depends(require_role("merchant", "admin"))):
    doc = await db.athletes.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Nessun atleta con questo codice")
    return Athlete(**doc)


# ---------- merchants ----------
@router.get("/merchants", response_model=List[Merchant])
async def list_merchants():
    docs = await db.merchants.find({}, {"_id": 0}).sort("business_name", 1).to_list(1000)
    return [Merchant(**d) for d in docs]


@router.get("/merchants/me", response_model=Merchant)
async def my_merchant(user: dict = Depends(require_role("merchant"))):
    doc = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Merchant(**doc)


@router.put("/merchants/me", response_model=Merchant)
async def update_my_merchant(body: MerchantUpdate, user: dict = Depends(require_role("merchant"))):
    doc = await db.merchants.find_one_and_update(
        {"user_id": user["id"]}, {"$set": body.model_dump()}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return Merchant(**doc)
