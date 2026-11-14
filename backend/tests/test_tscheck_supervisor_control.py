"""Supervisor has full control over every account.

Logs in as the supervisor EXACTLY ONCE in this whole test session (each step-1 login sends
a real email to the owner's mailbox). Mutations are performed on a fresh tscheck-* board
member and a fresh tscheck-* merchant created by this test (never on seeded accounts), except
for the self-protection checks which read/assert on the supervisor's own account without
changing it.
"""

import subprocess
import sys
import uuid

import httpx
import pytest

from .conftest import api_url

SUPERVISOR_EMAIL = "gi.mannone@gmail.com"
SUPERVISOR_PASSWORD = "Giuseppe71@2026"


def _set_code(challenge_id: str) -> None:
    subprocess.run(
        [sys.executable, "/tmp/otp.py", challenge_id],
        cwd="/app/backend",
        check=True,
        capture_output=True,
    )


@pytest.fixture
def supervisor():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": SUPERVISOR_EMAIL, "password": SUPERVISOR_PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["otp_required"] is True
        challenge_id = body["challenge_id"]
        _set_code(challenge_id)
        r = c.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "123456", "trust_device": False})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["is_superadmin"] is True
        assert sorted(r.json()["user"]["areas"]) == sorted(["athletes", "merchants", "reports", "content", "board"])
        yield c
        c.post("/auth/logout")


def test_supervisor_full_control(supervisor):
    c = supervisor
    me = c.get("/auth/me").json()
    sup_id = me["user"]["id"]

    # lists for every role work
    for role in ("admin", "merchant", "athlete"):
        r = c.get("/admin/supervisor/accounts", params={"role": role})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    # supervisor itself cannot be blocked
    r = c.patch(f"/admin/supervisor/accounts/{sup_id}/status", json={"active": False})
    assert r.status_code == 400, r.text

    # the supervisor removing ITSELF is rejected as "can't remove your own account" (400)
    r = c.delete(f"/admin/admins/{sup_id}")
    assert r.status_code == 400, r.text

    # a DIFFERENT board member trying to remove the supervisor gets the dedicated 403 instead
    with httpx.Client(base_url=api_url(), timeout=30.0) as other:
        r = other.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert r.status_code == 200, r.text
        body = r.json()
        if body["otp_required"]:
            challenge_id = body["challenge_id"]
            _set_code(challenge_id)
            r = other.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "123456", "trust_device": False})
            assert r.status_code == 200, r.text
        r = other.delete(f"/admin/admins/{sup_id}")
        assert r.status_code == 403, r.text
        other.post("/auth/logout")

    # fresh tscheck board member: create, set permissions, change status, then delete (our own fixture)
    suffix = uuid.uuid4().hex[:8]
    board_email = f"tscheck-board-{suffix}@example.it"
    r = c.post("/admin/admins", json={"email": board_email})
    assert r.status_code == 200, r.text
    board_id = r.json()["id"]

    r = c.put(f"/admin/supervisor/accounts/{board_id}/permissions", json={"areas": ["athletes", "content"]})
    assert r.status_code == 200, r.text
    assert sorted(r.json()["areas"]) == sorted(["athletes", "content"])

    r = c.patch(f"/admin/supervisor/accounts/{board_id}/status", json={"active": False})
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False

    r = c.patch(f"/admin/supervisor/accounts/{board_id}/status", json={"active": True})
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is True

    r = c.delete(f"/admin/admins/{board_id}")
    assert r.status_code == 200, r.text

    # fresh tscheck merchant: register, then flip status via supervisor and restore
    merchant_email = f"tscheck-merchant-{suffix}@example.it"
    r = c.post(
        "/auth/register/merchant",
        json={
            "account_email": merchant_email,
            "password": "Tscheck2026!",
            "business_name": f"TSCHECK Merchant {suffix}",
            "vat_number": "12345678901",
            "address": "Via Test 1, Torino",
            "description": "fixture",
        },
    )
    assert r.status_code == 200, r.text

    r = c.get("/admin/supervisor/accounts", params={"role": "merchant"})
    assert r.status_code == 200
    merchant_id = next(a["id"] for a in r.json() if a["email"] == merchant_email)

    r = c.patch(f"/admin/supervisor/accounts/{merchant_id}/status", json={"active": False})
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False

    r = c.patch(f"/admin/supervisor/accounts/{merchant_id}/status", json={"active": True})
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is True
