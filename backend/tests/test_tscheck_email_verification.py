"""Criterion: new self-registered users must confirm their email before logging in.
- POST /auth/login with an unverified account -> 403, detail starts with 'Conferma'
- POST /auth/resend-verification -> {ok: true} always (no enumeration)
- A valid token (inserted directly into email_tokens, as the briefing instructs) verifies the
  account via POST /auth/verify-email, returns Me + sets a session; reusing it -> 400
- Existing (pre-verification-feature) accounts still log in normally
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from tests.conftest import api_url

try:
    from pymongo import MongoClient
    import os as _os
    from pathlib import Path as _Path

    def _load_backend_env() -> None:
        env_path = _Path(__file__).resolve().parents[1] / ".env"
        if not env_path.exists():
            return
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            _os.environ.setdefault(k.strip(), v.strip().strip('"'))

    def _mongo_db():
        _load_backend_env()
        url = _os.environ.get("MONGO_URL")
        name = _os.environ.get("DB_NAME", "app")
        if not url:
            return None
        return MongoClient(url, serverSelectionTimeoutMS=5000)[name]
except Exception:  # pragma: no cover
    _mongo_db = lambda: None


def _register_athlete(suffix: str) -> dict:
    email = f"tscheck-verify-{suffix}@example.it"
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/register/athlete", json={
            "email": email, "password": "Tscheck2026!",
            "first_name": "Tscheck", "last_name": f"Verify{suffix}",
            "category_custom": "Test", "team_role": "",
        })
        assert r.status_code == 200, r.text
    return {"email": email}


@pytest.fixture
def admin_client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert r.status_code == 200, r.text
        yield c
        c.post("/auth/logout")


def test_unverified_login_rejected_and_resend_ok():
    suffix = uuid.uuid4().hex[:8]
    reg = _register_athlete(suffix)

    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": reg["email"], "password": "Tscheck2026!"})
        assert r.status_code == 403, r.text
        assert r.json()["detail"].startswith("Conferma"), r.json()

        r2 = c.post("/auth/resend-verification", json={"email": reg["email"]})
        assert r2.status_code == 200, r2.text
        assert r2.json() == {"ok": True}

        # no enumeration: unknown address returns the same shape
        r3 = c.post("/auth/resend-verification", json={"email": f"tscheck-nouser-{suffix}@example.it"})
        assert r3.status_code == 200, r3.text
        assert r3.json() == {"ok": True}


def test_existing_account_without_verified_flag_still_logs_in():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "giulia.rossi@example.it", "password": "Atleta2026!"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "athlete"
        c.post("/auth/logout")


def test_valid_token_verifies_and_reuse_fails(admin_client):
    db = _mongo_db()
    if db is None:
        pytest.skip("MONGO_URL not available to the test process")

    suffix = uuid.uuid4().hex[:8]
    reg = _register_athlete(suffix)
    user = db.users.find_one({"email": reg["email"]})
    assert user, "freshly registered user not found in db"

    token = f"tscheck-token-{suffix}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db.email_tokens.insert_one({
        "token_hash": token_hash, "user_id": user["id"], "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "created_at": datetime.now(timezone.utc),
    })

    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/verify-email", json={"token": token})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == reg["email"]
        assert body["user"]["role"] == "athlete"

        # session was set
        me = c.get("/auth/me")
        assert me.status_code == 200, me.text

        # reuse -> 400
        r2 = c.post("/auth/verify-email", json={"token": token})
        assert r2.status_code == 400, r2.text
        c.post("/auth/logout")

    # deactivate the created test athlete (never delete)
    athlete = db.athletes.find_one({"user_id": user["id"]})
    if athlete:
        admin_client.patch(f"/admin/athletes/{athlete['id']}/status", json={"active": False})


def test_verify_email_invalid_token_returns_400():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/verify-email", json={"token": "not-a-real-token"})
        assert r.status_code == 400, r.text
