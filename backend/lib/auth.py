"""Password hashing, httpOnly-cookie JWT sessions and role guards.

The role is re-read from the users collection on every request (never trusted from the token).
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response

from lib.db import db

JWT_SECRET = os.environ["JWT_SECRET"]
COOKIE_NAME = "lv_session"
SESSION_DAYS = 7


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(candidate, digest)


def set_session(response: Response, request: Request, user_id: str) -> None:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    token = jwt.encode({"sub": user_id, "exp": exp}, JWT_SECRET, algorithm="HS256")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=proto == "https",
        max_age=SESSION_DAYS * 86400,
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessione scaduta")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    if user.get("is_active") is False:
        raise HTTPException(status_code=401, detail="Account disattivato: contatta il direttivo")
    if user.get("email_verified") is False:
        raise HTTPException(status_code=401, detail="Email non ancora confermata")
    return user


# ---------- board areas (per-member permissions, managed only by the supervisor) ----------
AREAS = ("athletes", "merchants", "reports", "content", "board")
# admin-only API paths -> area. Admin paths not listed need a member with ALL areas (fail-closed).
_AREA_PREFIXES = (
    ("/api/admin/athletes", "athletes"), ("/api/athletes", "athletes"),
    ("/api/admin/merchants", "merchants"), ("/api/geocode", "merchants"),
    ("/api/admin/reports", "reports"), ("/api/admin/rankings", "reports"), ("/api/admin/transactions", "reports"),
    ("/api/admin/promo-digest", "reports"),
    ("/api/admin/news", "content"), ("/api/news", "content"), ("/api/admin/event-photos", "content"),
    ("/api/association", "content"), ("/api/categories", "content"), ("/api/admin/categories", "content"),
    ("/api/admin/email", "content"),
    ("/api/admin/admins", "board"),
)


def is_super(user: dict) -> bool:
    return user.get("role") == "admin" and user.get("is_superadmin") is True


def user_areas(user: dict) -> list[str]:
    """None/absent permissions = autonomous board member with every area."""
    if user.get("role") != "admin":
        return []
    perms = user.get("permissions")
    return list(AREAS) if is_super(user) or perms is None else [a for a in perms if a in AREAS]


def area_for_path(path: str) -> str | None:
    for prefix, area in _AREA_PREFIXES:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
            return area
    return None


def require_role(*roles: str):
    async def dependency(request: Request, user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Accesso non consentito")
        if user["role"] == "admin" and not is_super(user):
            areas = user_areas(user)
            area = area_for_path(request.url.path)
            if (area and area not in areas) or (area is None and len(areas) < len(AREAS)):
                raise HTTPException(status_code=403, detail="Il supervisore non ti ha dato accesso a quest'area")
        return user

    return dependency


async def require_super(user: dict = Depends(current_user)) -> dict:
    if not is_super(user):
        raise HTTPException(status_code=403, detail="Riservato al supervisore")
    return user


# ---------- trusted devices for the email login code (300 days, stored server-side so users can revoke them) ----------
TRUST_COOKIE = "lv_trust"
TRUST_DAYS = 300


def _device_label(ua: str) -> str:
    ua = ua or ""
    os_ = next((n for k, n in (("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"), ("Windows", "Windows"),
                                ("Mac OS", "Mac"), ("Linux", "Linux")) if k in ua), "Dispositivo")
    br = next((n for k, n in (("Edg/", "Edge"), ("SamsungBrowser", "Samsung Internet"), ("CriOS", "Chrome"), ("Chrome/", "Chrome"),
                               ("Firefox/", "Firefox"), ("Safari/", "Safari")) if k in ua), "browser")
    return f"{br} su {os_}"


async def set_trusted_device(response: Response, request: Request, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=TRUST_DAYS)
    device_id = secrets.token_urlsafe(16)
    await db.trusted_devices.insert_one({"id": device_id, "user_id": user_id, "label": _device_label(request.headers.get("user-agent", "")),
                                         "created_at": now, "last_used_at": now, "expires_at": exp, "revoked": False})
    token = jwt.encode({"sub": user_id, "did": device_id, "typ": "trust", "exp": exp}, JWT_SECRET, algorithm="HS256")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    response.set_cookie(TRUST_COOKIE, token, httponly=True, samesite="lax", secure=proto == "https",
                        max_age=TRUST_DAYS * 86400, path="/")


async def is_trusted_device(request: Request, user_id: str) -> bool:
    token = request.cookies.get(TRUST_COOKIE)
    if not token:
        return False
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    if payload.get("typ") != "trust" or payload.get("sub") != user_id or not payload.get("did"):
        return False
    res = await db.trusted_devices.update_one(
        {"id": payload["did"], "user_id": user_id, "revoked": False, "expires_at": {"$gt": datetime.now(timezone.utc)}},
        {"$set": {"last_used_at": datetime.now(timezone.utc)}},
    )
    return res.matched_count == 1


def current_device_id(request: Request) -> str | None:
    try:
        return jwt.decode(request.cookies.get(TRUST_COOKIE, ""), JWT_SECRET, algorithms=["HS256"]).get("did")
    except jwt.PyJWTError:
        return None
