import secrets
import string
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

from lib.auth import clear_session, current_user, hash_password, set_session, verify_password
from lib.db import db
from lib.storage import save_gallery, save_image
from lib.geocode import resolve_coords
from routers.notify import announce_merchant, public_base, token_hash
from models.schemas import (
    Athlete,
    AthleteRegister,
    LoginIn,
    Me,
    Merchant,
    MerchantRegister,
    MerchantUpdate,
    PasswordTokenInfo,
    SetPasswordIn,
    UserOut,
    new_id,
    now_utc,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def new_athlete_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "LV-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not await db.athletes.find_one({"code": code}) and not await db.family_members.find_one({"code": code}):
            return code


async def build_me(user: dict) -> Me:
    me = Me(user=UserOut(**user))
    if user["role"] == "athlete":
        doc = await db.athletes.find_one({"user_id": user["id"]}, {"_id": 0})
        if doc:
            me.athlete = Athlete(**doc, email=user["email"])
    elif user["role"] == "merchant":
        doc = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
        if doc:
            me.merchant = Merchant(**doc)
    return me


async def ensure_email_free(email: str) -> None:
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email già registrata")


@router.post("/register/athlete", response_model=Me)
async def register_athlete(body: AthleteRegister, request: Request, response: Response):
    email = body.email.lower()
    await ensure_email_free(email)
    cat = await db.categories.find_one({"id": body.category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    user = {"id": new_id(), "email": email, "password_hash": hash_password(body.password),
            "role": "athlete", "created_at": now_utc()}
    photo = await save_image(body.photo, kind="athletes", owner_user_id=user["id"], public=False)
    await db.users.insert_one(user)
    await db.athletes.insert_one({
        "id": new_id(), "user_id": user["id"], "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(), "category_id": cat["id"], "category_name": cat["name"],
        "photo": photo, "code": await new_athlete_code(), "created_at": now_utc(),
    })
    set_session(response, request, user["id"])
    return await build_me(user)


@router.post("/register/merchant", response_model=Me)
async def register_merchant(body: MerchantRegister, request: Request, response: Response, background: BackgroundTasks):
    email = body.account_email.lower()
    await ensure_email_free(email)
    user = {"id": new_id(), "email": email, "password_hash": hash_password(body.password),
            "role": "merchant", "created_at": now_utc()}
    profile = MerchantUpdate(**body.model_dump()).model_dump()
    profile["logo"] = await save_image(profile["logo"], kind="merchants", owner_user_id=user["id"], public=True)
    profile["gallery"] = await save_gallery(profile["gallery"], owner_user_id=user["id"])
    profile = await resolve_coords(profile, None)
    await db.users.insert_one(user)
    if not profile["email"]:
        profile["email"] = email
    mid = new_id()
    await db.merchants.insert_one({**profile, "id": mid, "user_id": user["id"], "created_at": now_utc()})
    background.add_task(announce_merchant, mid, public_base(request))
    set_session(response, request, user["id"])
    return await build_me(user)


@router.post("/login", response_model=Me)
async def login(body: LoginIn, request: Request, response: Response):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    set_session(response, request, user["id"])
    return await build_me(user)


async def _valid_token(token: str) -> dict:
    doc = await db.password_tokens.find_one({"token_hash": token_hash(token), "used": False})
    if not doc or doc["expires_at"] < now_utc():
        raise HTTPException(status_code=400, detail="Link non valido o scaduto: chiedi al direttivo un nuovo invito")
    return doc


@router.get("/password-token/{token}", response_model=PasswordTokenInfo)
async def password_token_info(token: str):
    doc = await _valid_token(token)
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Account non trovato")
    m = await db.merchants.find_one({"user_id": user["id"]}, {"business_name": 1})
    return PasswordTokenInfo(email=user["email"], business_name=m["business_name"] if m else "")


@router.post("/set-password", response_model=Me)
async def set_password(body: SetPasswordIn, request: Request, response: Response):
    doc = await _valid_token(body.token)
    res = await db.password_tokens.update_one({"_id": doc["_id"], "used": False}, {"$set": {"used": True}})
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Link già utilizzato")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    set_session(response, request, user["id"])
    return await build_me(user)


@router.post("/logout")
async def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@router.get("/me", response_model=Optional[Me])
async def me(request: Request):
    """Returns null (200) for anonymous visitors so public pages can probe the session quietly."""
    try:
        user = await current_user(request)
    except HTTPException:
        return None
    return await build_me(user)
