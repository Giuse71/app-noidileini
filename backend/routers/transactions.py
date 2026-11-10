from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, require_role
from lib.db import db
from models.schemas import Transaction, TransactionCreate

router = APIRouter(tags=["transactions"])


@router.post("/transactions", response_model=Transaction)
async def create_transaction(body: TransactionCreate, user: dict = Depends(require_role("merchant"))):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Profilo commerciante non trovato")
    athlete = await db.athletes.find_one({"id": body.athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    amount = round(body.amount, 2)
    pct = float(merchant.get("discount_percent", 0))
    discount = round(amount * pct / 100, 2)
    tx = Transaction(
        merchant_id=merchant["id"], merchant_name=merchant["business_name"],
        athlete_id=athlete["id"], athlete_name=f'{athlete["first_name"]} {athlete["last_name"]}',
        athlete_code=athlete["code"], category_name=athlete.get("category_name", ""),
        amount=amount, discount_percent=pct, discount_amount=discount,
        final_amount=round(amount - discount, 2), note=body.note.strip(),
    )
    await db.transactions.insert_one(tx.model_dump())
    return tx


@router.get("/transactions/mine", response_model=List[Transaction])
async def my_transactions(user: dict = Depends(current_user)):
    if user["role"] == "athlete":
        owner = await db.athletes.find_one({"user_id": user["id"]})
        flt = {"athlete_id": owner["id"]} if owner else None
    elif user["role"] == "merchant":
        owner = await db.merchants.find_one({"user_id": user["id"]})
        flt = {"merchant_id": owner["id"]} if owner else None
    else:
        raise HTTPException(status_code=403, detail="Accesso non consentito")
    if flt is None:
        return []
    return await db.transactions.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.get("/admin/transactions", response_model=List[Transaction], dependencies=[Depends(require_role("admin"))])
async def all_transactions():
    return await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
