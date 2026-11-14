"""Criterion: app runs on the new MongoDB Atlas database with all copied data.
Admin logs in; overview/athletes/merchants reflect the copied dataset."""

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


def test_admin_login_and_copied_data(admin_client):
    # admin session works
    me = admin_client.get("/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["user"]["role"] == "admin"

    # athletes list is populated (copied dataset: 38 athletes, residue from tscheck runs is fine)
    athletes = admin_client.get("/athletes", params={"status": "all"})
    assert athletes.status_code == 200, athletes.text
    assert len(athletes.json()) >= 30, f"expected copied athletes, got {len(athletes.json())}"

    # admin merchants list (includes unpublished)
    admin_merchants = admin_client.get("/admin/merchants")
    assert admin_merchants.status_code == 200, admin_merchants.text
    assert len(admin_merchants.json()) >= 15, f"expected 16 copied merchants, got {len(admin_merchants.json())}"


def test_public_merchants_endpoint_returns_published_only():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.get("/merchants")
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body) == 7, f"expected 7 published merchants, got {len(body)}: {[m.get('business_name') for m in body]}"
