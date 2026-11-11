"""Criterion: board member (admin) list is admin-only; self/last-admin removal is rejected."""


def test_board_list_requires_admin_role(client):
    anon = client.get("/admin/admins")
    assert anon.status_code == 401, anon.text

    r = client.post("/auth/login", json={"email": "pizzeria@example.it", "password": "Negozio2026!"})
    assert r.status_code == 200, r.text
    forbidden = client.get("/admin/admins")
    assert forbidden.status_code == 403, forbidden.text
    client.post("/auth/logout")


def test_admin_cannot_remove_self(client):
    r = client.post("/auth/login", json={"email": "admin@leinivolley.it", "password": "Admin2026!"})
    assert r.status_code == 200, r.text
    me = client.get("/auth/me").json()
    own_id = me["user"]["id"]

    r2 = client.delete(f"/admin/admins/{own_id}")
    assert r2.status_code == 400, r2.text
    client.post("/auth/logout")
