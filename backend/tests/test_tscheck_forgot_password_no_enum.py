"""Criterion: forgot-password API never reveals whether an email exists."""

import uuid


def test_forgot_password_unknown_and_known_email_both_200(client):
    unknown_email = f"tscheck-nouser-{uuid.uuid4().hex[:8]}@example.it"
    r1 = client.post("/auth/forgot-password", json={"email": unknown_email})
    assert r1.status_code == 200, r1.text
    assert r1.json() == {"ok": True}

    # giulia.rossi@example.it is a seeded existing user (never modified here, only read via this call)
    r2 = client.post("/auth/forgot-password", json={"email": "giulia.rossi@example.it"})
    assert r2.status_code == 200, r2.text
    assert r2.json() == {"ok": True}


def test_forgot_password_invalid_email_format_422(client):
    r = client.post("/auth/forgot-password", json={"email": "not-an-email"})
    assert r.status_code == 422, r.text
