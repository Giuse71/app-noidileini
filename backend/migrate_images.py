"""One-off, idempotent: move any data-URL images still inside Mongo documents to object storage.

Run: cd /app/backend && python migrate_images.py
"""

import asyncio

from lib.db import db
from lib.storage import save_image


async def main() -> None:
    moved = 0
    async for a in db.athletes.find({"photo": {"$regex": "^data:"}}, {"_id": 0, "id": 1, "user_id": 1, "photo": 1}):
        ref = await save_image(a["photo"], kind="athletes", owner_user_id=a["user_id"], public=False)
        await db.athletes.update_one({"id": a["id"]}, {"$set": {"photo": ref}})
        moved += 1
    async for m in db.merchants.find({"logo": {"$regex": "^data:"}}, {"_id": 0, "id": 1, "user_id": 1, "logo": 1}):
        ref = await save_image(m["logo"], kind="merchants", owner_user_id=m["user_id"], public=True)
        await db.merchants.update_one({"id": m["id"]}, {"$set": {"logo": ref}})
        moved += 1
    assoc = await db.association.find_one({"id": "main", "logo": {"$regex": "^data:"}})
    if assoc:
        ref = await save_image(assoc["logo"], kind="association", owner_user_id=None, public=True)
        await db.association.update_one({"id": "main"}, {"$set": {"logo": ref}})
        moved += 1
    print(f"migrated {moved} images")


if __name__ == "__main__":
    asyncio.run(main())
