"""Two-step email login for everyone (criterion: OTP second factor).

Uses a dedicated tscheck-* admin account (created directly in Mongo, never touching any seeded
account) so this test is fully isolated from other suites that also exercise admin@leinivolley.it
concurrently under the fixed 2-worker test runner. Code is forced to 123456 via the project's own
testing helper (/tmp/otp.py) instead of reading real mail; this account's address never actually
gets an email (demo domain -> is_demo() even skips the background send attempt's real delivery).
"""

import subprocess
import sys
import uuid

import httpx
import pytest

from .conftest import api_url

sys.path.insert(0, "/app/backend")
from lib.auth import hash_password  # noqa: E402
from lib.db import db  # noqa: E402

PASSWORD = "Tscheck2026!"


def _set_code(challenge_id: str) -> None:
    subprocess.run(
        [sys.executable, "/tmp/otp.py", challenge_id],
        cwd="/app/backend",
        check=True,
        capture_output=True,
    )


@pytest.fixture
def client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        yield c


@pytest.fixture
async def fixture_email():
    # NOT an @example.* domain: those are the "demo" addresses the app deliberately refuses to
    # send a login code to (see test_tscheck_demo_blocked.py) -- this fixture needs OTP to proceed.
    email = f"tscheck-otp-{uuid.uuid4().hex[:8]}@tscheck-otp-fixture.dev"
    await db.users.insert_one({
        "id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(PASSWORD),
        "role": "admin", "permissions": ["athletes", "merchants", "reports", "content", "board"],
    })
    yield email
    await db.users.delete_one({"email": email})


def test_two_step_login_full_cycle(client, fixture_email):
    email = fixture_email

    # wrong password -> 401
    r = client.post("/auth/login", json={"email": email, "password": "WrongPass123!"})
    assert r.status_code == 401, r.text

    # correct password -> otp_required, challenge_id, email_hint, no session started
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["otp_required"] is True
    assert body.get("me") is None
    challenge_id = body["challenge_id"]
    assert challenge_id
    assert body.get("email_hint")

    me = client.get("/auth/me")
    assert me.status_code == 200 and me.json() is None, "no session should exist before OTP verification"

    # wrong code -> 400 with remaining attempts in the message
    r = client.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "000000", "trust_device": False})
    assert r.status_code == 400, r.text
    assert "tentativi" in r.json()["detail"].lower() or "scadut" in r.json()["detail"].lower()

    # force the real code server-side (testing trick, no mailbox access)
    _set_code(challenge_id)

    # correct code -> Me + session, with trust_device=true
    r = client.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "123456", "trust_device": True})
    assert r.status_code == 200, r.text
    me_body = r.json()
    assert me_body["user"]["email"] == email

    me = client.get("/auth/me")
    assert me.status_code == 200 and me.json() is not None, "session should now be active"

    # reused code -> 400 (already marked used)
    r = client.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "123456", "trust_device": False})
    assert r.status_code == 400, r.text

    # logout, then login again from the SAME client (trusted device cookie persists) -> no OTP needed
    client.post("/auth/logout")
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    body2 = r.json()
    assert body2["otp_required"] is False
    assert body2["me"]["user"]["email"] == email

    client.post("/auth/logout")
