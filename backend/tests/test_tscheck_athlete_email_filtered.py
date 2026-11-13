"""Criterion: board emails only the filtered athletes -> demo @example.* addresses skipped,
empty subject -> 422, merchant -> 403."""

import uuid

import httpx
import pytest

from tests.conftest import api_url


@pytest.fixture
def admin_client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert r.status_code == 200, r.text
        yield c
        c.post("/auth/logout")


def test_email_filtered_skips_demo_addresses(admin_client):
    suffix = uuid.uuid4().hex[:8]
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/register/athlete", json={
            "email": f"tscheck-email-{suffix}@example.it", "password": "Tscheck2026!",
            "first_name": "Tscheck", "last_name": f"Mailme{suffix}",
            "category_custom": "Test", "team_role": "",
        })
        assert r.status_code == 200, r.text
        athlete_id = r.json()["athlete"]["id"]

    r = admin_client.post("/admin/athletes/email", json={
        "q": f"Mailme{suffix}", "subject": "Test tscheck", "message": "Ciao squadra",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["recipients"] == 0, body  # @example.it is a demo domain
    assert body["skipped"] == 1, body

    # empty subject -> 422
    r_bad = admin_client.post("/admin/athletes/email", json={
        "q": f"Mailme{suffix}", "subject": "", "message": "Ciao",
    })
    assert r_bad.status_code == 422, r_bad.text

    # merchant forbidden
    with httpx.Client(base_url=api_url(), timeout=30.0) as mc:
        rm = mc.post("/auth/login", json={"email": "pizzeria@example.it", "password": "Negozio2026!"})
        assert rm.status_code == 200, rm.text
        r_forbidden = mc.post("/admin/athletes/email", json={"subject": "x", "message": "y"})
        assert r_forbidden.status_code == 403, r_forbidden.text
        mc.post("/auth/logout")

    admin_client.patch(f"/admin/athletes/{athlete_id}/status", json={"active": False})
