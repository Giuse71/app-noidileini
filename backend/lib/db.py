"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True),
              IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "athletes": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
                 IndexModel([("code", ASCENDING)], name="code", unique=True),
                 IndexModel([("last_name", ASCENDING), ("first_name", ASCENDING)], name="name")],
    "merchants": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                  IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
                  IndexModel([("business_name", ASCENDING)], name="business_name")],
    "categories": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                   IndexModel([("order", ASCENDING)], name="order")],
    "association": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "family_members": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                       IndexModel([("code", ASCENDING)], name="code", unique=True),
                       IndexModel([("athlete_id", ASCENDING), ("created_at", ASCENDING)], name="athlete_created")],
    "report_logs": [IndexModel([("created_at", DESCENDING)], name="created_desc"),
                    IndexModel([("month", ASCENDING), ("merchant_id", ASCENDING), ("status", ASCENDING)], name="month_merchant")],
    "password_tokens": [IndexModel([("token_hash", ASCENDING)], name="token_hash", unique=True),
                        IndexModel([("user_id", ASCENDING), ("used", ASCENDING)], name="user_used")],
    "files": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
    "transactions": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                     IndexModel([("created_at", DESCENDING)], name="created_desc"),
                     IndexModel([("athlete_id", ASCENDING), ("created_at", DESCENDING)], name="athlete_created"),
                     IndexModel([("merchant_id", ASCENDING), ("created_at", DESCENDING)], name="merchant_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
