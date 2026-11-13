"""Association settings and categories (public read, admin write)."""

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_role
from lib.db import db
from lib.storage import save_image
from models.schemas import AdoptCategoryResult, Association, Category, CategoryIn, ProposedCategory

router = APIRouter(tags=["club"])
admin_only = require_role("admin")


@router.get("/association", response_model=Association)
async def get_association():
    doc = await db.association.find_one({"id": "main"}, {"_id": 0})
    return Association(**(doc or {}))


@router.put("/association", response_model=Association, dependencies=[Depends(admin_only)])
async def update_association(body: Association):
    current = await db.association.find_one({"id": "main"}, {"logo": 1, "hero_image": 1}) or {}
    body.logo = await save_image(body.logo, kind="association", owner_user_id=None, public=True, old=current.get("logo"), board=True)
    body.hero_image = await save_image(body.hero_image, kind="site", owner_user_id=None, public=True, old=current.get("hero_image"), board=True)
    await db.association.update_one({"id": "main"}, {"$set": body.model_dump()}, upsert=True)
    return body


@router.get("/categories", response_model=List[Category])
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)


@router.post("/categories", response_model=Category, dependencies=[Depends(admin_only)])
async def create_category(body: CategoryIn):
    name = body.name.strip()
    if await db.categories.find_one({"name": name}):
        raise HTTPException(status_code=409, detail="Categoria già esistente")
    last = await db.categories.find_one({}, sort=[("order", -1)])
    cat = Category(name=name, order=(last["order"] + 1) if last else 0)
    await db.categories.insert_one(cat.model_dump())
    return cat


@router.delete("/categories/{id}", dependencies=[Depends(admin_only)])
async def delete_category(id: str):
    res = await db.categories.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    await db.athletes.update_many({"category_id": id}, {"$set": {"category_id": None, "category_name": ""}})
    return {"ok": True}


# ---------- categories typed by athletes ("Altro") ----------
@router.get("/admin/categories/proposed", response_model=List[ProposedCategory], dependencies=[Depends(admin_only)])
async def proposed_categories():
    groups: dict[str, ProposedCategory] = {}
    async for a in db.athletes.find({"category_id": None, "category_name": {"$nin": ["", None]}, "is_active": {"$ne": False}},
                                    {"_id": 0, "category_name": 1}):
        name = " ".join(a["category_name"].split())
        key = name.lower()
        if key in groups:
            groups[key].count += 1
        else:
            groups[key] = ProposedCategory(name=name, count=1)
    return sorted(groups.values(), key=lambda g: (-g.count, g.name.lower()))


@router.post("/admin/categories/adopt", response_model=AdoptCategoryResult, dependencies=[Depends(admin_only)])
async def adopt_category(body: CategoryIn):
    """Adds a typed category to the official list and moves the athletes who typed it."""
    name = " ".join(body.name.split())
    rx = {"$regex": f"^{re.escape(name)}$", "$options": "i"}
    existing = await db.categories.find_one({"name": rx}, {"_id": 0})
    if existing:
        cat = Category(**existing)
    else:
        last = await db.categories.find_one({}, sort=[("order", -1)])
        cat = Category(name=name, order=(last["order"] + 1) if last else 0)
        await db.categories.insert_one(cat.model_dump())
    res = await db.athletes.update_many({"category_id": None, "category_name": rx},
                                        {"$set": {"category_id": cat.id, "category_name": cat.name}})
    return AdoptCategoryResult(category=cat, moved=res.modified_count)
