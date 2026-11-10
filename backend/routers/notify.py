"""Merchant invitations (set-password link) and 'new partner' announcements to athletes."""

import hashlib
import logging
import os
import secrets
from datetime import timedelta
from html import escape
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import require_role
from lib.db import db
from lib.email import EmailError, send_email
from models.schemas import InviteResult, now_utc

router = APIRouter(tags=["notify"])
logger = logging.getLogger(__name__)
DEMO_DOMAINS = ("@example.it", "@example.com", "@example.org")
TOKEN_DAYS = 7


def is_demo(email: str) -> bool:
    return not email or email.lower().endswith(DEMO_DOMAINS)


def public_base(request: Request) -> Optional[str]:
    """Public https origin the user is on (preview or production); None when not https."""
    origin = request.headers.get("origin", "")
    if not origin.startswith("https://"):
        host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        origin = f"{proto}://{host}" if host else ""
    if not origin.startswith("https://"):
        origin = os.environ.get("APP_URL", "")
    return origin.rstrip("/") if origin.startswith("https://") else None


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _assoc_name() -> str:
    assoc = await db.association.find_one({"id": "main"}, {"_id": 0, "name": 1, "email": 1}) or {}
    return assoc.get("name") or "Leinì Volley"


def _frame(assoc_name: str, inner: str) -> str:
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a">
<tr><td style="background:#1e3a8a;padding:20px 24px;color:#ffffff"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#eab308">Convenzione Sponsor</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">{escape(assoc_name)}</div></td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.55">{inner}
<p style="font-size:12px;color:#64748b;margin-top:24px">App Noi di Leyni · {escape(assoc_name)}</p></td></tr></table></td></tr></table>"""


def _button(href: str, label: str) -> str:
    return (f'<p style="margin:20px 0"><a href="{escape(href)}" style="background:#1d4ed8;color:#ffffff;'
            f'padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">{escape(label)}</a></p>')


# ---------- invitations ----------
@router.post("/admin/merchants/{id}/invite", response_model=InviteResult, dependencies=[Depends(require_role("admin"))])
async def invite_merchant(id: str, request: Request):
    merchant = await db.merchants.find_one({"id": id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Commerciante non trovato")
    user = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0})
    if not user or is_demo(user["email"]):
        raise HTTPException(status_code=400, detail="Imposta prima l'email reale di accesso del commerciante")
    base = public_base(request)
    if not base:
        raise HTTPException(status_code=400, detail="Indirizzo pubblico dell'app non disponibile")
    token = secrets.token_urlsafe(32)
    await db.password_tokens.update_many({"user_id": user["id"], "used": False}, {"$set": {"used": True}})
    await db.password_tokens.insert_one({"token_hash": token_hash(token), "user_id": user["id"], "used": False,
                                         "expires_at": now_utc() + timedelta(days=TOKEN_DAYS), "created_at": now_utc()})
    assoc_name = await _assoc_name()
    link = f"{base}/imposta-password?token={token}"
    inner = (
        f"<p>Ciao <strong>{escape(merchant['business_name'])}</strong>,</p>"
        f"<p>benvenuto tra i partner della convenzione sponsor di {escape(assoc_name)}! Da ora gli atleti e le loro famiglie "
        f"potranno trovarti nell'app e ottenere lo sconto riservato.</p>"
        f"<p>Il tuo accesso: <strong>{escape(user['email'])}</strong>. Scegli la tua password per entrare, completare logo e dati "
        f"della tua attività e iniziare a registrare le vendite in convenzione.</p>"
        f"{_button(link, 'Scegli la tua password')}"
        f"<p style=\"font-size:12px;color:#64748b\">Il pulsante è valido {TOKEN_DAYS} giorni. Se non ti aspettavi questo messaggio puoi ignorarlo.</p>"
    )
    try:
        await send_email(to=[user["email"]], subject=f"Benvenuto nella convenzione {assoc_name}", html=_frame(assoc_name, inner))
    except (EmailError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e))
    ts = now_utc()
    await db.merchants.update_one({"id": id}, {"$set": {"invited_at": ts}})
    return InviteResult(sent_to=user["email"], invited_at=ts)


# ---------- new partner announcement ----------
async def announce_merchant(merchant_id: str, base: Optional[str]) -> None:
    """Emails opted-in athletes once, the first time a merchant is visible. Idempotent via announced_at."""
    m = await db.merchants.find_one_and_update(
        {"id": merchant_id, "published": {"$ne": False}, "announced_at": None},
        {"$set": {"announced_at": now_utc()}}, projection={"_id": 0},
    )
    if not m:
        return
    assoc_name = await _assoc_name()
    pct = m.get("discount_percent", 0)
    pct_txt = f"{pct:g}".replace(".", ",")
    where = ", ".join(x for x in (m.get("address", ""), m.get("city", "")) if x)
    user_ids = [a["user_id"] async for a in db.athletes.find({"notify_new_partners": {"$ne": False}}, {"user_id": 1})]
    sector = f" ({escape(m['sector'])})" if m.get("sector") else ""
    desc = f"<p>{escape(m['description'])}</p>" if m.get("description") else ""
    where_html = f'<p style="color:#475569">{escape(where)}</p>' if where else ""
    button = _button(base + "/atleta/convenzioni", "Vedi le convenzioni") if base else ""
    inner = (
        f"<p>Buone notizie! <strong>{escape(m['business_name'])}</strong>{sector} è entrato nella convenzione sponsor.</p>"
        f'<p style="font-size:28px;font-weight:bold;color:#1e3a8a;margin:12px 0">-{escape(pct_txt)}% '
        f'<span style="font-size:14px;color:#475569;font-weight:normal">per te e la tua famiglia</span></p>'
        f"{desc}{where_html}<p>Mostra la tua tessera digitale prima di pagare.</p>{button}"
        f'<p style="font-size:12px;color:#64748b">Non vuoi più questi avvisi? Disattivali dal tuo profilo nell\'app.</p>'
    )
    sent = 0
    async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "email": 1}):
        if is_demo(u["email"]):
            continue
        try:
            await send_email(to=[u["email"]], subject=f"Nuovo partner: {m['business_name']} -{pct_txt}%", html=_frame(assoc_name, inner))
            sent += 1
        except (EmailError, ValueError) as e:
            logger.warning("announce to %s failed: %s", u["email"], e)
    logger.info("announced merchant %s to %s athletes", m["business_name"], sent)
