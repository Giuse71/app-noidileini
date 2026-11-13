"""Single-service production: FastAPI also serves the built React app (frontend/dist).

Enabled only when FRONTEND_DIST points to a folder with index.html (set in the Dockerfile).
/api/* is never answered with the SPA: unknown API paths stay JSON 404, so the browser can
never receive index.html in place of a login response.
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse

NO_CACHE = {"Cache-Control": "no-cache"}


def mount_spa(app: FastAPI) -> bool:
    dist = Path(os.environ.get("FRONTEND_DIST", "")).resolve() if os.environ.get("FRONTEND_DIST") else None
    if not dist or not (dist / "index.html").is_file():
        return False
    index = dist / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str, request: Request):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        target = (dist / full_path).resolve()
        if full_path and dist in target.parents and target.is_file():
            # hashed bundles can be cached forever; sw.js / manifest must stay fresh
            immutable = full_path.startswith("assets/")
            headers = {"Cache-Control": "public, max-age=31536000, immutable"} if immutable else NO_CACHE
            return FileResponse(target, headers=headers)
        return FileResponse(index, headers=NO_CACHE)

    return True
