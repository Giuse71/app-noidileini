"""Copy every collection of the app database (MONGO_URL/DB_NAME) into another MongoDB, e.g. Atlas.

Non-destructive: documents are upserted by _id, nothing is deleted on either side, so it can be re-run safely.
Usage:
  cd /app/backend
  python copy_db.py --dry-run                # just counts
  python copy_db.py                          # copy into ATLAS_MONGO_URL, database TARGET_DB_NAME (default: DB_NAME)
Source: SOURCE_MONGO_URL (default the in-pod mongodb://localhost:27017), database DB_NAME.
"""

import argparse
import os
import re

from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

load_dotenv()


def clean_url(raw: str) -> str:
    raw = raw.strip().strip('"').strip("'")
    raw = re.sub(r"^\s*MONGO_URL\s*=\s*", "", raw).strip().strip('"').strip("'")
    return re.sub(r"://([^:/]+):<([^>]+)>@", r"://\1:\2@", raw)  # Atlas "<password>" placeholder brackets


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src_db_name = os.environ["DB_NAME"]
    dst_db_name = os.environ.get("TARGET_DB_NAME") or src_db_name
    src = MongoClient(os.environ.get("SOURCE_MONGO_URL") or "mongodb://localhost:27017", serverSelectionTimeoutMS=8000)[src_db_name]
    dst_client = MongoClient(clean_url(os.environ["ATLAS_MONGO_URL"]), serverSelectionTimeoutMS=15000)
    dst_client.admin.command("ping")
    dst = dst_client[dst_db_name]
    print(f"source db '{src_db_name}' -> target db '{dst_db_name}'")

    for name in sorted(src.list_collection_names()):
        if name.startswith("system."):
            continue
        docs = list(src[name].find({}))
        if not args.dry_run and docs:
            for i in range(0, len(docs), 500):
                dst[name].bulk_write([ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs[i:i + 500]], ordered=False)
        print(f"{name}: {len(docs)} docs" + ("" if args.dry_run else f" -> target now {dst[name].count_documents({})}"))
    print("dry run, nothing written" if args.dry_run else "copy done (indexes are created by the app at startup)")


if __name__ == "__main__":
    main()
