"""App icons (favicon, home-screen, PWA) generated from the association logo set in Admin → Associazione."""

import asyncio
import json
import io
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response
from PIL import Image

from lib.db import db
from lib.storage import get_object

router = APIRouter(tags=["icons"])

SIZES = {16, 32, 180, 192, 512}
DEFAULT_ICON = Path(__file__).resolve().parent.parent / "default-icon.png"
_cache: dict[tuple[str, int, bool], bytes] = {}


async def _logo_ref() -> str:
    doc = await db.association.find_one({"id": "main"}, {"logo": 1}) or {}
    return doc.get("logo") or ""


async def _logo_bytes(ref: str) -> bytes:
    if ref.startswith("/api/files/"):
        rec = await db.files.find_one({"id": ref.rsplit("/", 1)[-1], "is_deleted": False}, {"_id": 0})
        if rec:
            try:
                data, _ = await asyncio.to_thread(get_object, rec["storage_path"])
                return data
            except Exception:
                pass
    return DEFAULT_ICON.read_bytes()


def _render(src: bytes, size: int, maskable: bool) -> bytes:
    logo = Image.open(io.BytesIO(src)).convert("RGBA")
    if logo.getchannel("A").getextrema()[0] == 255:
        # opaque photo-style logo: centre-crop to a square so it fills the icon edge to edge
        side = min(logo.size)
        left, top = (logo.width - side) // 2, (logo.height - side) // 2
        logo = logo.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
        out = io.BytesIO()
        logo.convert("RGB").save(out, "PNG", optimize=True)
        return out.getvalue()
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    # tiny favicons use the full square; home-screen icons keep a safe margin
    pad = 0.2 if maskable else (0.06 if size >= 180 else 0)
    box = max(1, int(size * (1 - 2 * pad)))
    logo.thumbnail((box, box), Image.LANCZOS)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    out = io.BytesIO()
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    return out.getvalue()


@router.get("/icons/{size}.png")
async def icon(size: int, maskable: bool = False):
    if size not in SIZES:
        raise HTTPException(status_code=404, detail="Dimensione non disponibile")
    ref = await _logo_ref()
    key = (ref, size, maskable)
    if key not in _cache:
        _cache[key] = await asyncio.to_thread(_render, await _logo_bytes(ref), size, maskable)
    return Response(content=_cache[key], media_type="image/png", headers={"Cache-Control": "public, max-age=300"})


@router.get("/manifest.webmanifest")
async def manifest():
    v = (await _logo_ref()).rsplit("/", 1)[-1] or "default"
    icons = [
        {"src": f"/api/icons/{s}.png?v={v}", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any"} for s in (192, 512)
    ] + [
        {"src": f"/api/icons/{s}.png?maskable=true&v={v}", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "maskable"}
        for s in (192, 512)
    ]
    body = {
        "name": "App Noi di Leyni · Leinì Volley",
        "short_name": "Noi di Leyni",
        "description": "Tessera digitale e convenzioni sponsor del Leinì Volley",
        "start_url": "/atleta",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#1e3a8a",
        "theme_color": "#1d4ed8",
        "lang": "it",
        "icons": icons,
    }
    return Response(content=json.dumps(body), media_type="application/manifest+json", headers={"Cache-Control": "no-cache"})
