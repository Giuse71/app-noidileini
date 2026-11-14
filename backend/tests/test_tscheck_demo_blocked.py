"""Demo accounts (@example.it / @example.com) are deactivated on purpose and cannot log in."""

import httpx
import pytest

from .conftest import api_url

DEMO_EMAIL = "giulia.rossi@example.it"
DEMO_PASSWORD = "Atleta2026!"


@pytest.fixture
def client():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        yield c


def test_demo_account_login_blocked(client):
    r = client.post("/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 403, r.text
    assert "disattivato" in r.json()["detail"].lower()
