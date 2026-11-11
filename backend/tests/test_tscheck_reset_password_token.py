"""Criterion: reset link (password_tokens row) sets a new password and logs in; reuse fails."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pytest_asyncio
import pytest


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@pytest_asyncio.fixture
async def temp_user(client):
    """Creates a tscheck- athlete user via the real register API, deletes it afterwards."""
    cats = client.get("/categories").json()
    email = f"tscheck-reset-{uuid.uuid4().hex[:8]}@example.it"
    payload = {
        "email": email,
        "password": "Original2026!",
        "first_name": "Tscheck",
        "last_name": "Reset",
        "category_id": cats[0]["id"],
        "photo": None,
        "notify_new_partners": False,
    }
    r = client.post("/auth/register/athlete", json=payload)
    assert r.status_code == 200, r.text
    user_id = r.json()["user"]["id"]
    yield {"email": email, "user_id": user_id}

    # cleanup: only rows this fixture created
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    m = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbx = m[os.environ.get("DB_NAME", "app")]
    await dbx.athletes.delete_one({"user_id": user_id})
    await dbx.users.delete_one({"id": user_id})
    await dbx.password_tokens.delete_many({"user_id": user_id})
    m.close()


@pytest_asyncio.fixture
async def mongo_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    m = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbx = m[os.environ.get("DB_NAME", "app")]
    yield dbx
    m.close()


@pytest.mark.asyncio
async def test_reset_token_sets_password_and_reuse_fails(client, temp_user, mongo_db):
    token = secrets.token_urlsafe(32)
    await mongo_db.password_tokens.insert_one({
        "token_hash": token_hash(token),
        "user_id": temp_user["user_id"],
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
        "created_at": datetime.now(timezone.utc),
    })

    # GET password-token info returns the email
    info = client.get(f"/auth/password-token/{token}")
    assert info.status_code == 200, info.text
    assert info.json()["email"] == temp_user["email"]

    # set-password logs in with a new session
    r = client.post("/auth/set-password", json={"token": token, "password": "BrandNew2026!"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == temp_user["email"]

    # reusing the same token fails
    r2 = client.post("/auth/set-password", json={"token": token, "password": "AnotherOne2026!"})
    assert r2.status_code == 400, r2.text
