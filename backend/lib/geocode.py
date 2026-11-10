"""Address → coordinates via OpenStreetMap Nominatim (no key).

Usage policy: identifying User-Agent, ≤ 1 request/second, cache results, geocode only on save.
"""

import asyncio
import logging
import re
from typing import Optional

import httpx

from lib.db import db

logger = logging.getLogger(__name__)
NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "noi-di-leyni/1.0 (App Noi di Leyni - A.S.D. Leini Volley)"
_lock = asyncio.Lock()


def _norm(address: str, city: str) -> str:
    return re.sub(r"\s+", " ", f"{address}, {city or 'Leinì'}").strip().lower()


async def geocode(address: str, city: str) -> Optional[tuple[float, float]]:
    if not address or len(address.strip()) < 3:
        return None
    key = _norm(address, city)
    hit = await db.geocodes.find_one({"query": key})
    if hit:
        return (hit["lat"], hit["lng"]) if hit.get("lat") is not None else None
    async with _lock:
        hit = await db.geocodes.find_one({"query": key})
        if hit:
            return (hit["lat"], hit["lng"]) if hit.get("lat") is not None else None
        await asyncio.sleep(1.1)  # ≤ 1 req/s
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0), headers={"User-Agent": USER_AGENT}) as c:
                r = await c.get(NOMINATIM, params={"q": f"{address}, {city or 'Leinì'}, Torino, Italia", "format": "jsonv2",
                                                    "limit": 1, "countrycodes": "it", "accept-language": "it"})
            r.raise_for_status()
            results = r.json()
        except Exception as e:  # noqa: BLE001 - geocoding must never block a save
            logger.warning("geocode failed for %r: %s", key, e)
            return None
        lat, lng = (float(results[0]["lat"]), float(results[0]["lon"])) if results else (None, None)
        await db.geocodes.update_one({"query": key}, {"$set": {"query": key, "lat": lat, "lng": lng}}, upsert=True)
        return (lat, lng) if lat is not None else None


async def resolve_coords(new: dict, old: Optional[dict]) -> dict:
    """Keep manual coordinates; (re)geocode when missing or when the address changed but the pin did not."""
    address_changed = old is None or (new.get("address"), new.get("city")) != (old.get("address"), old.get("city"))
    pin_moved = old is not None and (new.get("lat"), new.get("lng")) != (old.get("lat"), old.get("lng"))
    if new.get("lat") is not None and new.get("lng") is not None and (pin_moved or not address_changed):
        return new
    if new.get("lat") is not None and not address_changed:
        return new
    coords = await geocode(new.get("address", ""), new.get("city", ""))
    if coords:
        new["lat"], new["lng"] = coords
    return new
