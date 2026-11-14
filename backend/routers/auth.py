import hmac
import secrets
from datetime import timedelta
import string
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response

from lib.auth import clear_session, current_device_id, current_user, hash_password, is_super, is_trusted_device, set_session, set_trusted_device, user_areas, verify_password
from lib.categories import resolve_category
from lib.db import db
from lib.storage import save_gallery, save_image
from lib.geocode import resolve_coords
from routers.notify import OTP_MINUTES, announce_merchant, is_demo, public_base, send_login_code, send_verification, token_hash

OTP_ATTEMPTS = 5
OTP_REUSE_SECONDS = 120
OTP_PER_HOUR = 6

UNVERIFIED = "Conferma prima la tua email: apri il link che ti abbiamo inviato (controlla anche lo spam)"
from models.schemas import (
    TrustedDevice,
    LoginResult,
    OtpResendIn,
    OtpVerifyIn,
    EmailTokenIn,
    RegisterResult,
    ResendVerificationIn,
    Athlete,
    ChangePasswordIn,
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
    me = Me(user=UserOut(**{**user, "is_superadmin": is_super(user), "areas": user_areas(user)}))
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


@router.post("/register/athlete", response_model=RegisterResult)
async def register_athlete(body: AthleteRegister, request: Request, background: BackgroundTasks):
    email = body.email.lower()
    await ensure_email_free(email)
    cat_id, cat_name = await resolve_category(body.category_id, body.category_custom)
    # self-registered accounts stay locked until the email address is confirmed
    user = {"id": new_id(), "email": email, "password_hash": hash_password(body.password),
            "role": "athlete", "email_verified": False, "via_invite": body.via_invite, "created_at": now_utc()}
    photo = await save_image(body.photo, kind="athletes", owner_user_id=user["id"], public=False)
    await db.users.insert_one(user)
    await db.athletes.insert_one({
        "id": new_id(), "user_id": user["id"], "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(), "category_id": cat_id, "category_name": cat_name,
        "team_role": " ".join(body.team_role.split()), "photo": photo, "code": await new_athlete_code(), "created_at": now_utc(),
    })
    background.add_task(send_verification, user, public_base(request))
    return RegisterResult(email=email)


@router.post("/register/merchant", response_model=RegisterResult)
async def register_merchant(body: MerchantRegister, request: Request, background: BackgroundTasks):
    email = body.account_email.lower()
    await ensure_email_free(email)
    user = {"id": new_id(), "email": email, "password_hash": hash_password(body.password),
            "role": "merchant", "email_verified": False, "via_invite": body.via_invite, "created_at": now_utc()}
    profile = MerchantUpdate(**body.model_dump(exclude={"via_invite", "account_email", "password"})).model_dump()
    profile["logo"] = await save_image(profile["logo"], kind="merchants", owner_user_id=user["id"], public=True)
    profile["gallery"] = await save_gallery(profile["gallery"], owner_user_id=user["id"])
    profile = await resolve_coords(profile, None)
    await db.users.insert_one(user)
    if not profile["email"]:
        profile["email"] = email
    mid = new_id()
    await db.merchants.insert_one({**profile, "id": mid, "user_id": user["id"], "created_at": now_utc()})
    # athletes hear about the new partner only after the merchant confirmed the email (see verify_email)
    background.add_task(send_verification, user, public_base(request))
    return RegisterResult(email=email)


@router.post("/login", response_model=LoginResult)
async def login(body: LoginIn, request: Request, response: Response, background: BackgroundTasks):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Account disattivato: contatta il direttivo")
    if user.get("email_verified") is False:
        raise HTTPException(status_code=403, detail=UNVERIFIED)
    # second factor for everyone: a 6-digit code by email, skipped on a device trusted in the last 300 days
    if await is_trusted_device(request, user["id"]):
        set_session(response, request, user["id"])
        return LoginResult(otp_required=False, me=await build_me(user))
    if is_demo(user["email"]):
        raise HTTPException(status_code=403, detail="Questo indirizzo non può ricevere il codice di accesso")
    local, _, domain = user["email"].partition("@")
    hint = f"{local[:2]}•••@{domain}"
    # a code sent in the last 2 minutes is still on its way: reuse it instead of mailing another one
    recent = await db.login_codes.find_one({"user_id": user["id"], "used": False, "expires_at": {"$gt": now_utc()},
                                            "created_at": {"$gt": now_utc() - timedelta(seconds=OTP_REUSE_SECONDS)}},
                                           sort=[("created_at", -1)])
    if recent:
        return LoginResult(otp_required=True, challenge_id=recent["id"], email_hint=hint)
    if await db.login_codes.count_documents({"user_id": user["id"], "created_at": {"$gt": now_utc() - timedelta(hours=1)}}) >= OTP_PER_HOUR:
        raise HTTPException(status_code=429, detail="Troppi codici richiesti: riprova tra un'ora o usa l'ultimo codice ricevuto")
    challenge_id = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.login_codes.update_many({"user_id": user["id"], "used": False}, {"$set": {"used": True}})
    await db.login_codes.insert_one({"id": challenge_id, "user_id": user["id"], "code_hash": token_hash(code), "used": False,
                                     "attempts": 0, "expires_at": now_utc() + timedelta(minutes=OTP_MINUTES), "created_at": now_utc()})
    background.add_task(send_login_code, user["email"], code)
    return LoginResult(otp_required=True, challenge_id=challenge_id, email_hint=hint)


@router.post("/login/verify", response_model=Me)
async def login_verify(body: OtpVerifyIn, request: Request, response: Response):
    doc = await db.login_codes.find_one({"id": body.challenge_id, "used": False, "expires_at": {"$gt": now_utc()}})
    if not doc or doc.get("attempts", 0) >= OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Codice scaduto: torna indietro e accedi di nuovo")
    if not hmac.compare_digest(doc["code_hash"], token_hash(body.code)):
        await db.login_codes.update_one({"id": doc["id"]}, {"$inc": {"attempts": 1}})
        left = OTP_ATTEMPTS - doc.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Codice errato ({left} tentativi rimasti)" if left > 0 else "Troppi tentativi: accedi di nuovo")
    await db.login_codes.update_one({"id": doc["id"]}, {"$set": {"used": True, "used_at": now_utc()}})
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    if not user or user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Account disattivato: contatta il direttivo")
    set_session(response, request, user["id"])
    if body.trust_device:
        await set_trusted_device(response, request, user["id"])
    return await build_me(user)


@router.post("/login/resend")
async def login_resend(body: OtpResendIn, background: BackgroundTasks):
    doc = await db.login_codes.find_one({"id": body.challenge_id, "used": False, "expires_at": {"$gt": now_utc()}})
    if not doc:
        raise HTTPException(status_code=400, detail="Codice scaduto: accedi di nuovo")
    if doc["created_at"] > now_utc() - timedelta(seconds=45) and doc.get("resent_at", doc["created_at"]) > now_utc() - timedelta(seconds=45):
        raise HTTPException(status_code=429, detail="Attendi qualche secondo prima di chiedere un nuovo codice")
    if doc.get("resends", 0) >= 3:
        raise HTTPException(status_code=429, detail="Hai già chiesto 3 nuovi codici: controlla lo spam o accedi di nuovo più tardi")
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1})
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.login_codes.update_one({"id": doc["id"]}, {"$set": {"code_hash": token_hash(code), "attempts": 0, "resent_at": now_utc(),
                                                                   "resends": doc.get("resends", 0) + 1,
                                                                   "expires_at": now_utc() + timedelta(minutes=OTP_MINUTES)}})
    background.add_task(send_login_code, user["email"], code)
    return {"ok": True}


@router.post("/verify-email", response_model=Me)
async def verify_email(body: EmailTokenIn, request: Request, response: Response, background: BackgroundTasks):
    doc = await db.email_tokens.find_one_and_update(
        {"token_hash": token_hash(body.token), "used": False, "expires_at": {"$gt": now_utc()}},
        {"$set": {"used": True, "used_at": now_utc()}},
    )
    if not doc:
        raise HTTPException(status_code=400, detail="Link non valido o scaduto: accedi per riceverne uno nuovo")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"email_verified": True, "email_verified_at": now_utc()}})
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    if not user or user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Account disattivato: contatta il direttivo")
    if user["role"] == "merchant":
        m = await db.merchants.find_one({"user_id": user["id"]}, {"id": 1})
        if m:
            background.add_task(announce_merchant, m["id"], public_base(request))
    set_session(response, request, user["id"])
    return await build_me(user)


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationIn, request: Request, background: BackgroundTasks):
    """Generic answer: never reveals whether the address is registered."""
    user = await db.users.find_one({"email": body.email.lower(), "email_verified": False}, {"_id": 0})
    if user:
        background.add_task(send_verification, user, public_base(request))
    return {"ok": True}


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
    # the link arrived by email, so the address is proven
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password), "email_verified": True}})
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    set_session(response, request, user["id"])
    return await build_me(user)


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="La password attuale non è corretta")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="La nuova password deve essere diversa da quella attuale")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    # any pending invitation link must not be able to override the new password
    await db.password_tokens.update_many({"user_id": user["id"], "used": False}, {"$set": {"used": True}})
    return {"ok": True}


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


# ---------- trusted devices (skip the email code for 300 days) ----------
@router.get("/devices", response_model=list[TrustedDevice])
async def my_devices(request: Request, user: dict = Depends(current_user)):
    mine = current_device_id(request, user["id"])
    docs = await db.trusted_devices.find({"user_id": user["id"], "revoked": False, "expires_at": {"$gt": now_utc()}},
                                         {"_id": 0}).sort("last_used_at", -1).to_list(50)
    return [TrustedDevice(**d, is_current=d["id"] == mine) for d in docs]


@router.delete("/devices/{id}")
async def revoke_device(id: str, user: dict = Depends(current_user)):
    res = await db.trusted_devices.update_one({"id": id, "user_id": user["id"], "revoked": False},
                                              {"$set": {"revoked": True, "revoked_at": now_utc()}})
    if not res.modified_count:
        raise HTTPException(status_code=404, detail="Dispositivo non trovato")
    return {"ok": True}
