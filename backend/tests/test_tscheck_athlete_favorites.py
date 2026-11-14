"""Criterion: athletes save partners in favourites and filter them.
PUT/GET/DELETE /athletes/me/favorites persists server-side for the logged-in athlete."""

import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

from tests.conftest import api_url

try:
    from pymongo import MongoClient

    def _load_backend_env() -> None:
        env_path = Path(__file__).resolve().parents[1] / ".env"
        if not env_path.exists():
            return
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

    def _mongo_db():
        _load_backend_env()
        url = os.environ.get("MONGO_URL")
        name = os.environ.get("DB_NAME", "app")
        if not url:
            return None
        return MongoClient(url, serverSelectionTimeoutMS=5000)[name]
except Exception:  # pragma: no cover
    _mongo_db = lambda: None


def test_favorite_add_persists_and_remove_clears():
    db = _mongo_db()
    if db is None:
        pytest.skip("MONGO_URL not available to the test process")

    suffix = uuid.uuid4().hex[:8]
    email = f"tscheck-fav-{suffix}@example.it"
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/register/athlete", json={
            "email": email, "password": "Tscheck2026!",
            "first_name": "Tscheck", "last_name": f"Fav{suffix}",
            "category_custom": "Test", "team_role": "",
        })
        assert r.status_code == 200, r.text
        user = db.users.find_one({"email": email})
        assert user

        token = f"tscheck-fav-token-{suffix}"
        db.email_tokens.insert_one({
            "token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["id"], "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "created_at": datetime.now(timezone.utc),
        })
        verify = c.post("/auth/verify-email", json={"token": token})
        assert verify.status_code == 200, verify.text

        merchants = c.get("/merchants")
        assert merchants.status_code == 200 and len(merchants.json()) > 0, merchants.text
        merchant_id = merchants.json()[0]["id"]

        empty = c.get("/athletes/me/favorites")
        assert empty.status_code == 200 and empty.json()["merchant_ids"] == [], empty.text

        added = c.put(f"/athletes/me/favorites/{merchant_id}")
        assert added.status_code == 200, added.text
        assert merchant_id in added.json()["merchant_ids"]

        fetched = c.get("/athletes/me/favorites")
        assert fetched.status_code == 200
        assert merchant_id in fetched.json()["merchant_ids"], "favorite did not persist server-side"

        removed = c.delete(f"/athletes/me/favorites/{merchant_id}")
        assert removed.status_code == 200, removed.text
        assert merchant_id not in removed.json()["merchant_ids"]

        c.post("/auth/logout")

    with httpx.Client(base_url=api_url(), timeout=30.0) as admin:
        ra = admin.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
        assert ra.status_code == 200, ra.text
        athlete = db.athletes.find_one({"user_id": user["id"]})
        if athlete:
            admin.patch(f"/admin/athletes/{athlete['id']}/status", json={"active": False})
        admin.post("/auth/logout")
