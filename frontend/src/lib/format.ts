import { format } from "date-fns";
import { ApiError } from "@/lib/api";
import type { MerchantUpdate, Transaction } from "@/lib/types";

const EUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export const eur = (n: number) => EUR.format(n);
export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")}%`;
export const dateTime = (s: string) => format(new Date(s), "dd/MM/yyyy HH:mm");

export const initials = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map((p) => p.trim()[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

export function parseAmount(raw: string): number {
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const FIELD_LABELS: Record<string, string> = {
  vat_number: "Partita IVA",
  business_name: "Nome attività",
  email: "Email",
  account_email: "Email di accesso",
  password: "Password",
  first_name: "Nome",
  last_name: "Cognome",
  category_id: "Categoria",
  discount_percent: "Sconto",
  amount: "Importo",
  name: "Nome",
};

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const detail = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const fields = detail
        .map((d: { loc?: unknown[] }) => String(d.loc?.[d.loc.length - 1] ?? ""))
        .map((f) => FIELD_LABELS[f] ?? f);
      return `Controlla i campi: ${[...new Set(fields)].join(", ")}`;
    }
    return `Errore ${e.status}`;
  }
  return "Impossibile contattare il server";
}

export const EMPTY_MERCHANT: MerchantUpdate = {
  business_name: "",
  legal_name: "",
  vat_number: "",
  sector: "",
  address: "",
  city: "Leinì",
  phone: "",
  email: "",
  website: "",
  description: "",
  logo: null,
  discount_percent: 10,
};

export function totals(rows: Transaction[]) {
  return {
    count: rows.length,
    amount: rows.reduce((s, r) => s + r.amount, 0),
    discount: rows.reduce((s, r) => s + r.discount_amount, 0),
    final: rows.reduce((s, r) => s + r.final_amount, 0),
    athletes: new Set(rows.map((r) => r.athlete_id)).size,
    merchants: new Set(rows.map((r) => r.merchant_id)).size,
  };
}

/** Resize an uploaded image client-side and return a compact data URL. */
export async function fileToDataUrl(file: File, max = 480): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
