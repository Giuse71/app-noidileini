import { useMemo, useState } from "react";
import { MapPin, Phone, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initials, pct } from "@/lib/format";
import { useMerchants } from "@/lib/session";
import type { Merchant } from "@/lib/types";
import { cn } from "@/lib/utils";

function MerchantCard({ m }: { m: Merchant }) {
  const [shown, setShown] = useState<number | null>(null);
  return (
    <article
      className="group animate-fade-up flex gap-4 rounded-xl border bg-card p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40"
      data-testid={`merchant-card-${m.id}`}
    >
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-accent font-bold text-primary">
        {m.logo ? <img src={m.logo} alt={m.business_name} className="size-full bg-white object-contain" /> : initials(...m.business_name.split(" "))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{m.business_name}</h3>
            {m.sector && <p className="text-xs text-muted-foreground">{m.sector}</p>}
          </div>
          <span className="tnum shrink-0 rounded-full bg-gold px-2.5 py-1 text-sm font-bold text-navy" data-testid={`merchant-discount-${m.id}`}>
            -{pct(m.discount_percent)}
          </span>
        </div>
        {m.promo_active && (
          <div className="mt-2 rounded-lg border border-gold/50 bg-gold-soft px-2.5 py-1.5 text-xs" data-testid={`merchant-promo-${m.id}`}>
            <p className="flex items-center gap-1 font-semibold text-gold-ink">
              <Sparkles className="size-3.5" /> {m.promo_title}
            </p>
            {m.promo_description && <p className="mt-0.5 text-muted-foreground">{m.promo_description}</p>}
          </div>
        )}
        {m.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
        {m.gallery.length > 0 && (
          <div className="mt-2 flex gap-1.5" data-testid={`merchant-gallery-thumbs-${m.id}`}>
            {m.gallery.slice(0, 4).map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setShown(i)}
                className="relative size-12 overflow-hidden rounded-md border transition-transform duration-200 hover:scale-105"
                data-testid={`merchant-gallery-thumb-${m.id}-${i}`}
              >
                <img src={src} alt={`${m.business_name} foto ${i + 1}`} loading="lazy" className="size-full object-cover" />
                {i === 3 && m.gallery.length > 4 && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-semibold text-white">+{m.gallery.length - 4}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <Dialog open={shown !== null} onOpenChange={(o) => !o && setShown(null)}>
          <DialogContent className="sm:max-w-2xl" data-testid={`merchant-gallery-dialog-${m.id}`}>
            <DialogHeader>
              <DialogTitle>{m.business_name}</DialogTitle>
              <DialogDescription>{[m.address, m.city].filter(Boolean).join(", ") || m.sector}</DialogDescription>
            </DialogHeader>
            {shown !== null && (
              <div className="space-y-3">
                <img src={m.gallery[shown]} alt="" className="max-h-[60dvh] w-full rounded-lg bg-muted object-contain" data-testid="merchant-gallery-large" />
                <div className="flex justify-center gap-2">
                  {m.gallery.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setShown(i)}
                      className={cn("size-12 overflow-hidden rounded-md border-2 transition-colors", i === shown ? "border-primary" : "border-transparent")}
                      data-testid={`merchant-gallery-select-${i}`}
                    >
                      <img src={src} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(m.address || m.city) && (
            <a
              className="flex items-center gap-1 hover:text-primary"
              href={`https://maps.google.com/?q=${encodeURIComponent(`${m.address} ${m.city}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="size-3.5" />
              {[m.address, m.city].filter(Boolean).join(", ")}
            </a>
          )}
          {m.phone && (
            <a className="flex items-center gap-1 hover:text-primary" href={`tel:${m.phone}`}>
              <Phone className="size-3.5" />
              {m.phone}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MerchantList({ limit }: { limit?: number }) {
  const { data, isLoading, isError } = useMerchants();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const merchants = isError ? [] : (data ?? []);
  const sectors = useMemo(() => [...new Set(merchants.map((m) => m.sector).filter(Boolean))].sort(), [merchants]);
  const filtered = merchants
    .filter((m) => (!sector || m.sector === sector) && `${m.business_name} ${m.sector}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, limit);

  return (
    <div className="space-y-4">
      {!limit && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca attività o settore…" className="h-10 pl-9" data-testid="merchant-search-input" />
          </div>
          <div className="flex flex-wrap gap-2">
            {["", ...sectors].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setSector(s)}
                data-testid={`sector-filter-${s || "tutti"}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  sector === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                )}
              >
                {s || "Tutti"}
              </button>
            ))}
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground" data-testid="merchant-list-empty">
          Nessun commerciante convenzionato da mostrare
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="merchant-list">
          {filtered.map((m) => (
            <MerchantCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
