"""Activity log for the supervisor: who did what to which account, and when."""

from lib.db import db
from models.schemas import now_utc


async def audit(actor: dict, action: str, target: dict | None = None, detail: dict | None = None) -> None:
    await db.audit_log.insert_one({
        "at": now_utc(), "actor_id": actor.get("id"), "actor_email": actor.get("email", ""), "action": action,
        "target_id": (target or {}).get("id"), "target_email": (target or {}).get("email", ""), "detail": detail or {},
    })
