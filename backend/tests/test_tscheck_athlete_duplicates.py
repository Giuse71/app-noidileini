"""Criterion: board sees possible duplicate athletes with a quick merge.
GET /admin/athletes/duplicates returns groups with reason name|email; merchant -> 403."""

import uuid

import httpx
import pytest

from tests.conftest import api_url


def _register_athlete(email: str, first: str, last: str, admin_client: httpx.Client) -> dict:
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/register/athlete", json={
            "email": email, "password": "Tscheck2026!",
            "first_name": first, "last_name": last,
            "category_custom": "Test", "team_role": "",
        })
        assert r.status_code == 200, r.text
    # registration now only returns {email}; look the athlete up via the admin list
    found = admin_client.get("/athletes", params={"status": "all", "q": last})
    assert found.status_code == 200, found.text
    rows = [a for a in found.json() if a.get("email") == email.lower()]
    assert rows, f"athlete with email {email} not found via admin search: {found.json()}"
    return rows[0]


@pytest.fixture
def admin_client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert r.status_code == 200, r.text
        yield c
        c.post("/auth/logout")


def test_duplicates_lists_name_match_and_merchant_forbidden(admin_client):
    suffix = uuid.uuid4().hex[:8]
    first, last = "Tscheckdup", f"Pair{suffix}"
    a1 = _register_athlete(f"tscheck-dupA-{suffix}@example.it", first, last, admin_client)
    a2 = _register_athlete(f"tscheck-dupB-{suffix}@example.it", first, last, admin_client)

    r = admin_client.get("/admin/athletes/duplicates")
    assert r.status_code == 200, r.text
    groups = r.json()
    match = [g for g in groups if g["reason"] == "name" and {a1["id"], a2["id"]} <= {a["id"] for a in g["athletes"]}]
    assert match, f"expected a name-duplicate group for {first} {last}, got {groups}"

    # merchant forbidden
    with httpx.Client(base_url=api_url(), timeout=30.0) as mc:
        rm = mc.post("/auth/login", json={"email": "pizzeria@example.it", "password": "Negozio2026!"})
        assert rm.status_code == 200, rm.text
        r_forbidden = mc.get("/admin/athletes/duplicates")
        assert r_forbidden.status_code == 403, r_forbidden.text
        mc.post("/auth/logout")

    # cleanup: deactivate both (never delete)
    admin_client.patch(f"/admin/athletes/{a1['id']}/status", json={"active": False})
    admin_client.patch(f"/admin/athletes/{a2['id']}/status", json={"active": False})
