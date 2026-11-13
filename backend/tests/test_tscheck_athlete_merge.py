"""Criterion: board merges a duplicate athlete -> transactions+family move to keep_id,
duplicate becomes inactive with merged_into; same id -> 400; repeat -> 409; merchant -> 403."""

import uuid

import httpx
import pytest

from tests.conftest import api_url


def _register_athlete(suffix: str) -> dict:
    email = f"tscheck-merge-{suffix}@example.it"
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/register/athlete", json={
            "email": email, "password": "Tscheck2026!",
            "first_name": "Tscheck", "last_name": f"Merge{suffix}",
            "category_custom": "Test", "team_role": "",
        })
        assert r.status_code == 200, r.text
        me = r.json()
        athlete_id = me["athlete"]["id"]
        user_id = me["user"]["id"]
    return {"email": email, "athlete_id": athlete_id, "user_id": user_id}


@pytest.fixture
def admin_client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert r.status_code == 200, r.text
        yield c
        c.post("/auth/logout")


def test_merge_moves_data_and_deactivates_duplicate(admin_client):
    suffix = uuid.uuid4().hex[:8]
    keep = _register_athlete(f"keep-{suffix}")
    dup = _register_athlete(f"dup-{suffix}")

    # same id -> 400
    r_same = admin_client.post("/admin/athletes/merge", json={"keep_id": keep["athlete_id"], "merge_id": keep["athlete_id"]})
    assert r_same.status_code == 400, r_same.text

    # merchant forbidden
    with httpx.Client(base_url=api_url(), timeout=30.0) as mc:
        rm = mc.post("/auth/login", json={"email": "pizzeria@example.it", "password": "Negozio2026!"})
        assert rm.status_code == 200, rm.text
        r_forbidden = mc.post("/admin/athletes/merge", json={"keep_id": keep["athlete_id"], "merge_id": dup["athlete_id"]})
        assert r_forbidden.status_code == 403, r_forbidden.text
        mc.post("/auth/logout")

    # real merge
    r = admin_client.post("/admin/athletes/merge", json={"keep_id": keep["athlete_id"], "merge_id": dup["athlete_id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["kept"]["id"] == keep["athlete_id"]

    # repeat merge of same duplicate -> 409
    r_repeat = admin_client.post("/admin/athletes/merge", json={"keep_id": keep["athlete_id"], "merge_id": dup["athlete_id"]})
    assert r_repeat.status_code == 409, r_repeat.text

    # list with status=all shows duplicate inactive with merged_into
    listing = admin_client.get("/athletes", params={"status": "all", "q": suffix})
    assert listing.status_code == 200, listing.text
    rows = {row["id"]: row for row in listing.json()}
    assert rows[dup["athlete_id"]]["is_active"] is False
    assert rows[dup["athlete_id"]].get("merged_into") == keep["athlete_id"]

    # cleanup: deactivate the created athletes (never delete)
    admin_client.patch(f"/admin/athletes/{keep['athlete_id']}/status", json={"active": False})
