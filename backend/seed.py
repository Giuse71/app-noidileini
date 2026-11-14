"""Idempotent bootstrap: indexes, association profile, default categories and (optionally) the first board account.

No demo/test users are created. The first admin comes from the environment, never from code:
  ADMIN_EMAIL=...  ADMIN_PASSWORD=...  python seed.py
It is created only if no admin exists yet; afterwards the board adds members from Admin → Direttivo.

Run: cd /app/backend && python seed.py
"""

import asyncio
import os

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from models.schemas import new_id, now_utc

LOGO = "https://static.prod-images.emergentagent.com/jobs/2c4a6118-06a9-456f-9d2e-e4e6f65bf957/images/9ae4b834a8e09accd1e2e51b15f1132bcfb4f1d541967caa96809fa7829a0ccf.jpeg"

CATEGORIES = ["Under 12", "Under 14", "Under 16", "Under 18", "Serie C Femminile", "Serie C Maschile", "Amatori", "Staff"]


async def ensure_first_admin() -> None:
    if await db.users.find_one({"role": "admin"}):
        return
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or len(password) < 8:
        print("no admin yet: set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) and run seed again")
        return
    await db.users.insert_one({"id": new_id(), "email": email, "password_hash": hash_password(password),
                               "role": "admin", "email_verified": True, "created_at": now_utc()})
    print(f"admin created: {email}")


async def main() -> None:
    await ensure_indexes()
    await ensure_first_admin()

    if not await db.association.find_one({"id": "main"}):
        await db.association.insert_one({
            "id": "main", "name": "A.S.D. Leinì Volley", "logo": LOGO,
            "address": "Palazzetto dello Sport, Via Volpiano", "city": "10040 Leinì (TO)",
            "vat_number": "", "fiscal_code": "", "phone": "",
            "website": "", "description": "Società di pallavolo di Leinì: settore giovanile, prime squadre e amatori.",
            "convention_rules": "Mostra la tua tessera digitale (QR) prima di pagare: il commerciante applica lo sconto della convenzione sponsor.",
        })

    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([{"id": new_id(), "name": n, "order": i} for i, n in enumerate(CATEGORIES)])

    print("seed ok")


if __name__ == "__main__":
    asyncio.run(main())
