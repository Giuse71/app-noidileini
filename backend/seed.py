"""Idempotent demo seed: admin, categories, association, athletes, merchants, transactions.

Run: cd /app/backend && python seed.py
"""

import asyncio
import random
from datetime import timedelta

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from models.schemas import new_id, now_utc

LOGO = "https://static.prod-images.emergentagent.com/jobs/2c4a6118-06a9-456f-9d2e-e4e6f65bf957/images/9ae4b834a8e09accd1e2e51b15f1132bcfb4f1d541967caa96809fa7829a0ccf.jpeg"

CATEGORIES = ["Under 12", "Under 14", "Under 16", "Under 18", "Serie C Femminile", "Serie C Maschile", "Amatori", "Staff"]

ATHLETES = [
    ("giulia.rossi@example.it", "Giulia", "Rossi", "Under 16", "LV-GR1606"),
    ("marco.bianchi@example.it", "Marco", "Bianchi", "Serie C Maschile", "LV-MB2201"),
    ("sofia.ferrari@example.it", "Sofia", "Ferrari", "Under 14", "LV-SF1403"),
    ("luca.romano@example.it", "Luca", "Romano", "Under 18", "LV-LR1810"),
    ("chiara.colombo@example.it", "Chiara", "Colombo", "Serie C Femminile", "LV-CC3007"),
    ("andrea.ricci@example.it", "Andrea", "Ricci", "Amatori", "LV-AR4412"),
    ("elena.marino@example.it", "Elena", "Marino", "Under 12", "LV-EM1205"),
    ("paolo.greco@example.it", "Paolo", "Greco", "Staff", "LV-PG9001"),
]

MERCHANTS = [
    ("pizzeria@example.it", "Pizzeria Da Gianni", "Da Gianni S.n.c.", "01234567890", "Pizzeria", "Via Torino 12", 15),
    ("ottica@example.it", "Ottica Leyni", "Ottica Leyni S.r.l.", "02345678901", "Ottico", "Piazza Vittorio Emanuele 3", 20),
    ("farmacia@example.it", "Farmacia San Giovanni", "Farmacia San Giovanni S.a.s.", "03456789012", "Farmacia", "Via Lombardore 45", 10),
    ("barsport@example.it", "Bar Sport Leinì", "Bar Sport di Ferri M.", "04567890123", "Bar", "Via Volpiano 8", 10),
    ("modain@example.it", "Abbigliamento Moda In", "Moda In S.r.l.", "05678901234", "Abbigliamento", "Via Carlo Alberto 21", 15),
    ("fisio@example.it", "Fisioterapia Reba", "Studio Reba S.t.p.", "06789012345", "Fisioterapia", "Via San Francesco al Campo 2", 25),
]


async def upsert_user(email: str, password: str, role: str) -> str:
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing["id"]
    uid = new_id()
    await db.users.insert_one({"id": uid, "email": email, "password_hash": hash_password(password),
                               "role": role, "created_at": now_utc()})
    return uid


async def main() -> None:
    await ensure_indexes()
    await upsert_user("admin@leinivolley.it", "Admin2026!", "admin")

    if not await db.association.find_one({"id": "main"}):
        await db.association.insert_one({
            "id": "main", "name": "A.S.D. Leinì Volley", "logo": LOGO,
            "address": "Palazzetto dello Sport, Via Volpiano", "city": "10040 Leinì (TO)",
            "vat_number": "", "fiscal_code": "", "email": "info@leinivolley.it", "phone": "",
            "website": "", "description": "Società di pallavolo di Leinì: settore giovanile, prime squadre e amatori.",
            "convention_rules": "Mostra la tua tessera digitale (QR) prima di pagare: il commerciante applica lo sconto della convenzione sponsor.",
        })

    cats = {}
    for i, name in enumerate(CATEGORIES):
        doc = await db.categories.find_one({"name": name})
        if not doc:
            doc = {"id": new_id(), "name": name, "order": i}
            await db.categories.insert_one(doc)
        cats[name] = doc["id"]

    athletes = []
    for email, first, last, cat, code in ATHLETES:
        uid = await upsert_user(email, "Atleta2026!", "athlete")
        doc = await db.athletes.find_one({"user_id": uid}, {"_id": 0})
        if not doc:
            doc = {"id": new_id(), "user_id": uid, "first_name": first, "last_name": last,
                   "category_id": cats[cat], "category_name": cat, "photo": None, "code": code,
                   "created_at": now_utc()}
            await db.athletes.insert_one(dict(doc))
        athletes.append(doc)

    merchants = []
    for email, name, legal, vat, sector, addr, pct in MERCHANTS:
        uid = await upsert_user(email, "Negozio2026!", "merchant")
        doc = await db.merchants.find_one({"user_id": uid}, {"_id": 0})
        if not doc:
            doc = {"id": new_id(), "user_id": uid, "business_name": name, "legal_name": legal,
                   "vat_number": vat, "sector": sector, "address": addr, "city": "Leinì",
                   "phone": "011 998 " + vat[-4:], "email": email, "website": "",
                   "description": f"{sector} convenzionato con il Leinì Volley.", "logo": None,
                   "discount_percent": pct, "created_at": now_utc()}
            await db.merchants.insert_one(dict(doc))
        merchants.append(doc)

    if await db.transactions.count_documents({}) == 0:
        rnd = random.Random(42)
        for i in range(14):
            a, m = rnd.choice(athletes), rnd.choice(merchants)
            amount = round(rnd.uniform(8.5, 120), 2)
            pct = float(m["discount_percent"])
            disc = round(amount * pct / 100, 2)
            await db.transactions.insert_one({
                "id": new_id(), "merchant_id": m["id"], "merchant_name": m["business_name"],
                "athlete_id": a["id"], "athlete_name": f'{a["first_name"]} {a["last_name"]}',
                "athlete_code": a["code"], "category_name": a["category_name"], "amount": amount,
                "discount_percent": pct, "discount_amount": disc, "final_amount": round(amount - disc, 2),
                "note": "", "created_at": now_utc() - timedelta(days=i * 2, hours=rnd.randint(0, 10)),
            })
    print("seed ok")


if __name__ == "__main__":
    asyncio.run(main())
