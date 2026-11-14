"""Criterion: merchant profile save works and triggers the favourite-promo alert hook
without errors. GET/PUT /merchants/me round-trip 200; POST /cron/favorite-promos without
bearer -> 401."""

import httpx

from tests.conftest import api_url


def test_merchant_me_get_and_put_round_trip():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "pizzeria@example.it", "password": "Negozio2026!"})
        assert r.status_code == 200, r.text

        before = c.get("/merchants/me")
        assert before.status_code == 200, before.text
        body = before.json()

        readonly = {"id", "created_at", "published", "promo_active", "rating_avg", "rating_count"}
        put_body = {k: v for k, v in body.items() if k not in readonly}
        after = c.put("/merchants/me", json=put_body)
        assert after.status_code == 200, after.text
        assert after.json()["business_name"] == body["business_name"]
        c.post("/auth/logout")


def test_cron_favorite_promos_requires_bearer():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/cron/favorite-promos")
        assert r.status_code == 401, r.text
