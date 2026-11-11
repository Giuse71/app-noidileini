"""Email: Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set, else Emergent managed email (Resend) — send helper + guardrail gate (from the integration playbook)."""

import asyncio
import ipaddress
import logging
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# Emergent managed email proxy. This is a CONSTANT — never read it from os.environ.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")  # missing key → sends fail, app still boots
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Leinì Volley")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
# Own Gmail account (Google "App password", 2-step verification required). Used automatically when both are set.
GMAIL_USER = (os.environ.get("GMAIL_USER") or "").strip()
GMAIL_APP_PASSWORD = (os.environ.get("GMAIL_APP_PASSWORD") or "").replace(" ", "")


def gmail_enabled() -> bool:
    return bool(GMAIL_USER and GMAIL_APP_PASSWORD)


def _plain_text(html: str) -> str:
    text = re.sub(r"<(br|/p|/div|/h[1-6]|/li|/tr)[^>]*>", "\n", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _send_gmail_sync(to: list[str], subject: str, html: str, reply_to: str | None) -> str:
    msg = EmailMessage()
    msg["From"] = formataddr((EMAIL_FROM_NAME, GMAIL_USER))
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=GMAIL_USER.split("@")[-1])
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(_plain_text(html))
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.send_message(msg)
    return msg["Message-ID"]


class EmailError(Exception):
    pass


_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: list[str], subject: str, html: str, reply_to: str | None = None) -> str | None:
    """Recipients come from server-side records, html from server-side templates only."""
    _assert_safe_email(subject, html)
    if gmail_enabled():
        try:
            return await asyncio.to_thread(_send_gmail_sync, to, subject, html, reply_to or EMAIL_REPLY_TO)
        except smtplib.SMTPAuthenticationError:
            logger.error("Gmail login rejected: check GMAIL_USER / GMAIL_APP_PASSWORD")
            raise EmailError("Accesso Gmail rifiutato: controlla la password per le app")
        except Exception as e:  # noqa: BLE001
            logger.error("Gmail send error: %s", type(e).__name__)
            raise EmailError("Errore di invio Gmail")
    payload = {"to": to, "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            body = e.response.json()
        except ValueError:
            body = {}
        code = body.get("code", "")
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning("Email paused: %s (%s): %s", code, e.response.status_code, body.get("message", ""))
            raise EmailError(f"Email temporaneamente non disponibile ({code})")
        logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
        raise EmailError(f"Invio fallito ({e.response.status_code})")
    except Exception as e:  # noqa: BLE001
        logger.error("Email send error: %s", e)
        raise EmailError("Errore di invio")
