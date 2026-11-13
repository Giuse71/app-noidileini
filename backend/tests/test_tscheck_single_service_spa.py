"""Single-service production mode (Render Docker deploy):
FastAPI serves the built SPA + the API from one origin on port 8019,
with FRONTEND_DIST=/app/frontend/dist. This suite assumes the server is
already running (started by the test harness before pytest, and torn
down afterward) -- see iteration report for the startup/teardown commands.
"""
import httpx

BASE = "http://localhost:8019"


def _get(client, path):
    return client.get(path, follow_redirects=False)


def test_spa_serves_html_for_app_routes():
    with httpx.Client(base_url=BASE, timeout=10) as client:
        for path in ["/", "/admin", "/atleta/profilo"]:
            r = _get(client, path)
            assert r.status_code == 200, f"{path} -> {r.status_code}"
            assert r.headers["content-type"].startswith("text/html"), path


def test_spa_serves_immutable_js_bundle():
    with httpx.Client(base_url=BASE, timeout=10) as client:
        # discover a hashed bundle from index.html
        r = _get(client, "/")
        html = r.text
        import re

        m = re.search(r'/assets/[\w.\-]+\.js', html)
        assert m, "no JS bundle referenced in index.html"
        bundle_path = m.group(0)
        r2 = client.get(bundle_path)
        assert r2.status_code == 200
        assert "javascript" in r2.headers["content-type"]
        assert "immutable" in r2.headers.get("cache-control", "")


def test_login_returns_json_not_html():
    with httpx.Client(base_url=BASE, timeout=10) as client:
        r = client.post(
            "/api/auth/login",
            json={"email": "admin@leinivolley.it", "password": "Admin2026!"},
        )
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/json")
        body = r.json()
        assert body["user"]["role"] == "admin"
        assert "lv_session" in r.headers.get("set-cookie", "")


def test_api_unknown_paths_are_json_404_and_405():
    with httpx.Client(base_url=BASE, timeout=10) as client:
        r = client.get("/api/nope")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/json")
        assert r.json()["detail"]

        r2 = client.get("/api")
        assert r2.status_code == 404
        assert r2.headers["content-type"].startswith("application/json")

        r3 = client.post("/api/nope")
        assert r3.status_code == 405
        assert r3.headers["content-type"].startswith("application/json")


def test_path_traversal_returns_spa_not_system_file():
    with httpx.Client(base_url=BASE, timeout=10) as client:
        r = client.get("/..%2f..%2fetc/passwd")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/html")
        assert "root:" not in r.text
