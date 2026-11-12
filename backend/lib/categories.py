"""Athlete category: pick one from the club list, or type your own."""

from fastapi import HTTPException

from lib.db import db


async def resolve_category(category_id: str, category_custom: str) -> tuple[str | None, str]:
    """Returns (category_id, category_name). A typed category is stored as name only (id None)."""
    if category_id:
        cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
        if not cat:
            raise HTTPException(status_code=400, detail="Categoria non valida")
        return cat["id"], cat["name"]
    custom = " ".join(category_custom.split())
    if not custom:
        raise HTTPException(status_code=400, detail="Scegli o scrivi la categoria di appartenenza")
    return None, custom
