"""Monthly sponsor report: per-merchant recap email (CC association), cron + admin triggers."""

import hmac
import logging
import os
from datetime import datetime, timezone
from html import escape
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from lib.auth import require_role
from lib.db import db
from lib.email import EMAIL_FROM_NAME, EmailError, send_email
from models.schemas import MonthlyMerchantRow, MonthlyReport, Ranking, RankingRow, ReportLog, SendReportResult, now_utc

router = APIRouter(tags=["reports"])
logger = logging.getLogger(__name__)
ROME = ZoneInfo("Europe/Rome")
MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
          "agosto", "settembre", "ottobre", "novembre", "dicembre"]
DEMO_DOMAINS = ("@example.it", "@example.com", "@example.org")  # seeded demo inboxes: never emailed


def previous_month() -> str:
    now = datetime.now(ROME)
    y, m = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
    return f"{y:04d}-{m:02d}"


def month_bounds(month: str) -> tuple[datetime, datetime]:
    try:
        y, m = (int(p) for p in month.split("-"))
        start = datetime(y, m, 1, tzinfo=ROME)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Mese non valido (formato AAAA-MM)")
    end = datetime(y + (m == 12), (m % 12) + 1, 1, tzinfo=ROME)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def month_label(month: str) -> str:
    y, m = month.split("-")
    return f"{MONTHS[int(m) - 1]} {y}"


def eur(n: float) -> str:
    return f"{n:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


async def build_report(month: str) -> tuple[MonthlyReport, dict[str, list[dict]]]:
    start, end = month_bounds(month)
    txs = await db.transactions.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).sort("created_at", 1).to_list(20000)
    by_merchant: dict[str, list[dict]] = {}
    for t in txs:
        by_merchant.setdefault(t["merchant_id"], []).append(t)
    rows = []
    for mid, items in by_merchant.items():
        merchant = await db.merchants.find_one({"id": mid}, {"_id": 0, "user_id": 1, "business_name": 1})
        user = await db.users.find_one({"id": merchant["user_id"]}, {"email": 1}) if merchant else None
        rows.append(MonthlyMerchantRow(
            merchant_id=mid, merchant_name=merchant["business_name"] if merchant else items[0]["merchant_name"],
            email=user["email"] if user else "", count=len(items),
            amount=round(sum(i["amount"] for i in items), 2),
            discount=round(sum(i["discount_amount"] for i in items), 2),
            final=round(sum(i["final_amount"] for i in items), 2),
            athletes=len({i["athlete_id"] for i in items}),
        ))
    rows.sort(key=lambda r: r.amount, reverse=True)
    return MonthlyReport(month=month, label=month_label(month), rows=rows), by_merchant


def render_email(row: MonthlyMerchantRow, items: list[dict], label: str, assoc_name: str) -> tuple[str, str]:
    subject = f"Report convenzione {assoc_name} – {label}"
    td = 'style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px"'
    tdr = 'style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right"'
    lines = "".join(
        f"<tr><td {td}>{escape(i['created_at'].astimezone(ROME).strftime('%d/%m/%Y %H:%M'))}</td>"
        f"<td {td}>{escape(i.get('family_member_name') or i['athlete_name'])}"
        f"{' (familiare di ' + escape(i['athlete_name']) + ')' if i.get('family_member_name') else ''}</td>"
        f"<td {tdr}>{eur(i['amount'])}</td><td {tdr}>-{eur(i['discount_amount'])}</td>"
        f"<td {tdr}><strong>{eur(i['final_amount'])}</strong></td></tr>"
        for i in items
    )
    stat = 'style="padding:12px;background:#eff6ff;border-radius:8px;font-family:Arial,sans-serif"'
    html = f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a">
<tr><td style="background:#1e3a8a;padding:20px 24px;color:#ffffff"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#eab308">Convenzione Sponsor</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">{escape(assoc_name)}</div></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Ciao <strong>{escape(row.merchant_name)}</strong>,</p>
<p style="margin:0 0 16px">ecco il riepilogo delle vendite in convenzione di <strong>{escape(label)}</strong>. Grazie per sostenere la nostra squadra!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="8"><tr>
<td {stat}><div style="font-size:11px;color:#475569">Transazioni</div><div style="font-size:18px;font-weight:bold">{row.count}</div></td>
<td {stat}><div style="font-size:11px;color:#475569">Atleti serviti</div><div style="font-size:18px;font-weight:bold">{row.athletes}</div></td>
<td {stat}><div style="font-size:11px;color:#475569">Lordo</div><div style="font-size:18px;font-weight:bold">{eur(row.amount)}</div></td>
<td style="padding:12px;background:#fefce8;border-radius:8px;font-family:Arial,sans-serif"><div style="font-size:11px;color:#854d0e">Sconti concessi</div><div style="font-size:18px;font-weight:bold;color:#854d0e">{eur(row.discount)}</div></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
<tr style="background:#f1f5f9"><th align="left" {td}>Data</th><th align="left" {td}>Tesserato</th><th {tdr}>Lordo</th><th {tdr}>Sconto</th><th {tdr}>Pagato</th></tr>
{lines}
<tr><td colspan="4" {tdr}><strong>Totale incassato</strong></td><td {tdr}><strong>{eur(row.final)}</strong></td></tr>
</table>
<p style="font-size:12px;color:#64748b;margin-top:24px">Inviato automaticamente da {escape(EMAIL_FROM_NAME)}. Il dettaglio completo è sempre disponibile nella sezione Storico della tua area commerciante.</p>
</td></tr></table></td></tr></table>"""
    return subject, html


async def send_monthly_reports(month: str, force: bool) -> SendReportResult:
    report, by_merchant = await build_report(month)
    assoc = await db.association.find_one({"id": "main"}, {"_id": 0}) or {}
    assoc_name = assoc.get("name") or "Leinì Volley"
    cc = (assoc.get("email") or "").strip().lower()
    sent = skipped = failed = 0
    for row in report.rows:
        if not force and await db.report_logs.find_one({"month": month, "merchant_id": row.merchant_id, "status": "sent"}):
            skipped += 1
            continue
        recipients = [r for r in dict.fromkeys([row.email.lower(), cc]) if r and not r.endswith(DEMO_DOMAINS)]
        log = ReportLog(month=month, merchant_id=row.merchant_id, merchant_name=row.merchant_name, recipients=recipients, status="sent")
        if not row.email or row.email.lower().endswith(DEMO_DOMAINS):
            log.status, log.detail = "skipped", "Email commerciante dimostrativa o mancante"
            skipped += 1
        else:
            subject, html = render_email(row, by_merchant[row.merchant_id], report.label, assoc_name)
            try:
                log.detail = await send_email(to=recipients, subject=subject, html=html, reply_to=cc or None) or ""
                sent += 1
            except (EmailError, ValueError) as e:
                log.status, log.detail = "failed", str(e)
                failed += 1
        await db.report_logs.insert_one(log.model_dump())
    logger.info("monthly report %s: sent=%s skipped=%s failed=%s", month, sent, skipped, failed)
    return SendReportResult(month=month, sent=sent, skipped=skipped, failed=failed)


# ---------- cron ----------
@router.post("/cron/monthly-report")
async def cron_monthly_report(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        envelope = await request.json()
    except Exception:
        envelope = None
    if envelope is not None and not isinstance(envelope, dict):
        raise HTTPException(status_code=400, detail="invalid body")
    run_id = request.headers.get("x-webhook-id") or (envelope or {}).get("run_id") or now_utc().isoformat()
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"accepted": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "monthly-report", "created_at": now_utc()})
    background.add_task(send_monthly_reports, previous_month(), False)
    return {"accepted": True}


# ---------- admin ----------
@router.get("/admin/reports/monthly", response_model=MonthlyReport, dependencies=[Depends(require_role("admin"))])
async def admin_monthly_report(month: Optional[str] = None):
    report, _ = await build_report(month or previous_month())
    return report


@router.post("/admin/reports/monthly/send", response_model=SendReportResult, dependencies=[Depends(require_role("admin"))])
async def admin_send_monthly(month: Optional[str] = None):
    return await send_monthly_reports(month or previous_month(), force=True)


@router.get("/admin/reports/logs", response_model=List[ReportLog], dependencies=[Depends(require_role("admin"))])
async def admin_report_logs():
    return await db.report_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- sponsor ranking (sport season: 1 Sep → 31 Aug) ----------
def current_season_start() -> int:
    now = datetime.now(ROME)
    return now.year if now.month >= 9 else now.year - 1


@router.get("/admin/rankings", response_model=Ranking, dependencies=[Depends(require_role("admin"))])
async def sponsor_ranking(season: Optional[int] = None):
    cur = current_season_start()
    y = season or cur
    if y < 2000 or y > cur:
        raise HTTPException(status_code=400, detail="Stagione non valida")
    start = datetime(y, 9, 1, tzinfo=ROME).astimezone(timezone.utc)
    end = datetime(y + 1, 9, 1, tzinfo=ROME).astimezone(timezone.utc)
    agg = db.transactions.aggregate([
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$merchant_id", "name": {"$last": "$merchant_name"}, "count": {"$sum": 1},
                    "amount": {"$sum": "$amount"}, "discount": {"$sum": "$discount_amount"},
                    "athletes": {"$addToSet": "$athlete_id"}}},
        {"$sort": {"discount": -1}},
    ])
    rows = []
    async for g in agg:
        m = await db.merchants.find_one({"id": g["_id"]}, {"_id": 0, "business_name": 1, "logo": 1, "sector": 1}) or {}
        rows.append(RankingRow(
            rank=len(rows) + 1, merchant_id=g["_id"], merchant_name=m.get("business_name") or g["name"],
            logo=m.get("logo"), sector=m.get("sector", ""), count=g["count"], amount=round(g["amount"], 2),
            discount=round(g["discount"], 2), athletes=len(g["athletes"]),
        ))
    return Ranking(start_year=y, current_start_year=cur, label=f"{y}/{y + 1}",
                   total_discount=round(sum(r.discount for r in rows), 2), rows=rows)
