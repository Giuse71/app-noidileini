"""Board members only see the areas the supervisor enabled for them.

Uses the supervisor's session (minted locally with the backend's own JWT_SECRET, exactly like
the login-session cookie the API itself would set) to avoid a THIRD real OTP email to the
owner's mailbox -- the supervisor has already been exercised twice via the OTP flow in
test_tscheck_supervisor_control.py and test_tscheck_otp_login.py's sibling checks, which is the
briefed budget. Narrows admin@leinivolley.it to ['athletes', 'content'], verifies access, then
ALWAYS restores all 5 areas (even on failure) since this is a real, briefed board account.
"""

import subprocess
import sys

import httpx
import jwt
import pytest

from .conftest import api_url

sys.path.insert(0, "/app/backend")
from lib.auth import JWT_SECRET  # noqa: E402

SUPERVISOR_ID = "7ed808ae-cd46-48fd-be7a-bed0ca8388c3"
BOARD_EMAIL = "admin@leinivolley.it"
BOARD_PASSWORD = "Admin2026!"
ALL_AREAS = ["athletes", "merchants", "reports", "content", "board"]
RESTRICTED_AREAS = ["athletes", "content"]


def _supervisor_token() -> str:
    from datetime import datetime, timedelta, timezone

    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": SUPERVISOR_ID, "exp": exp}, JWT_SECRET, algorithm="HS256")


def _set_code(challenge_id: str) -> None:
    subprocess.run([sys.executable, "/tmp/otp.py", challenge_id], cwd="/app/backend", check=True, capture_output=True)


@pytest.fixture
def sup_client():
    with httpx.Client(base_url=api_url(), timeout=30.0, cookies={"lv_session": _supervisor_token()}) as c:
        me = c.get("/auth/me")
        assert me.status_code == 200 and me.json()["user"]["is_superadmin"] is True
        yield c


def _board_id(sup_client) -> str:
    r = sup_client.get("/admin/supervisor/accounts", params={"role": "admin"})
    assert r.status_code == 200
    return next(a["id"] for a in r.json() if a["email"] == BOARD_EMAIL)


def _board_login() -> httpx.Client:
    c = httpx.Client(base_url=api_url(), timeout=30.0)
    r = c.post("/auth/login", json={"email": BOARD_EMAIL, "password": BOARD_PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    if body["otp_required"]:
        challenge_id = body["challenge_id"]
        _set_code(challenge_id)
        r = c.post("/auth/login/verify", json={"challenge_id": challenge_id, "code": "123456", "trust_device": False})
        assert r.status_code == 200, r.text
    return c


def test_board_member_restricted_areas(sup_client):
    board_id = _board_id(sup_client)
    try:
        r = sup_client.put(f"/admin/supervisor/accounts/{board_id}/permissions", json={"areas": RESTRICTED_AREAS})
        assert r.status_code == 200, r.text
        assert sorted(r.json()["areas"]) == sorted(RESTRICTED_AREAS)

        board = _board_login()
        try:
            me = board.get("/auth/me").json()
            assert sorted(me["user"]["areas"]) == sorted(RESTRICTED_AREAS)

            # allowed areas
            assert board.get("/athletes", params={"status": "all"}).status_code == 200
            assert board.get("/news").status_code == 200

            # forbidden areas -> 403
            for path in ("/admin/merchants", "/admin/transactions", "/admin/admins", "/admin/rankings"):
                r = board.get(path)
                assert r.status_code == 403, f"{path} -> {r.status_code}: {r.text}"
            r = board.get("/admin/supervisor/accounts", params={"role": "admin"})
            assert r.status_code == 403, r.text
        finally:
            board.post("/auth/logout")
            board.close()
    finally:
        r = sup_client.put(f"/admin/supervisor/accounts/{board_id}/permissions", json={"areas": ALL_AREAS})
        assert r.status_code == 200, r.text
        assert sorted(r.json()["areas"]) == sorted(ALL_AREAS)
