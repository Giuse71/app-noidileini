import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, MapPin, Phone, Search, Sparkles, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import Stars from "@/components/Stars";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initials, pct } from "@/lib/format";
import { useMerchants, useMe } from "@/lib/session";
import type { Merchant } from "@/lib/types";
import { cn } from "@/lib/utils";

function Logo({ m, className }: { m: Merchant; className: string }) {
  // logos are always shown whole (contain) on white, never cropped
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl border bg-white font-bold text-primary", className)}>
      {m.logo ? <img src={m.logo} alt={m.business_name} className="size-full object-contain p-1" /> : initials(...m.business_name.split(" "))}
    </div>
  );
}

function MerchantCard({ m, onOpen }: { m: Merchant; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Apri dettagli di ${m.business_name}`}
      className="group animate-fade-up flex w-full min-w-0 items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] sm:gap-4 sm:p-4"
      data-testid={`merchant-card-${m.id}`}
    >
      <Logo m={m} className="size-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{m.business_name}</h3>
            {m.sector && <p className="truncate text-xs text-muted-foreground">{m.sector}</p>}
            {m.rating_count > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground" data-testid={`merchant-rating-${m.id}`}>
                <Stars value={m.rating_avg} size="size-3.5" />
                <span className="tnum font-medium text-foreground">{m.rating_avg.toFixed(1).replace(".", ",")}</span>({m.rating_count})
              </p>
            )}
          </div>
          <span className="tnum shrink-0 rounded-full bg-gold px-2.5 py-1 text-sm font-bold text-navy" data-testid={`merchant-discount-${m.id}`}>
            -{pct(m.discount_percent)}
          </span>
        </div>
        {m.promo_active && (
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs font-semibold text-gold-ink" data-testid={`merchant-promo-${m.id}`}>
            <Sparkles className="size-3.5 shrink-0" /> <span className="truncate">{m.promo_title}</span>
          </p>
        )}
        {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
        <p className="mt-1.5 text-xs font-medium text-primary">Vedi sconto e dettagli</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </button>
  );
}

function MerchantDetail({ m, onClose }: { m: Merchant | null; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  const { data: me } = useMe();
  const isAthlete = me?.user.role === "athlete";
  const place = m ? [m.address, m.city].filter(Boolean).join(", ") : "";
  return (
    <Dialog
      open={m !== null}
      onOpenChange={(o) => {
        if (!o) {
          setShown(0);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="merchant-detail-dialog">
        {m && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 text-left">
                <Logo m={m} className="size-16" />
                <div className="min-w-0">
                  <DialogTitle className="truncate" data-testid="merchant-detail-name">{m.business_name}</DialogTitle>
                  <DialogDescription>{m.sector || "Partner convenzionato"}</DialogDescription>
                  {m.rating_count > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Stars value={m.rating_avg} size="size-3.5" />
                      <span className="tnum font-medium text-foreground">{m.rating_avg.toFixed(1).replace(".", ",")}</span>({m.rating_count} recensioni)
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl bg-navy p-4 text-white" data-testid="merchant-detail-discount">
              <Tag className="size-5 text-gold" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-blue-200">Sconto convenzione</p>
                <p className="tnum text-2xl font-bold text-gold">-{pct(m.discount_percent)}</p>
              </div>
              <p className="max-w-40 text-right text-xs text-blue-100">
                {isAthlete ? "Mostra la tua tessera QR prima di pagare" : "Riservato agli atleti e famiglie del Leinì Volley"}
              </p>
            </div>

            {m.promo_active && (
              <div className="rounded-xl border border-gold/50 bg-gold-soft p-3 text-sm" data-testid="merchant-detail-promo">
                <p className="flex items-center gap-1.5 font-semibold text-gold-ink">
                  <Sparkles className="size-4" /> {m.promo_title}
                </p>
                {m.promo_description && <p className="mt-1 text-muted-foreground">{m.promo_description}</p>}
                {m.promo_end && <p className="mt-1 text-xs text-gold-ink">Fino al {m.promo_end.split("-").reverse().join("/")}</p>}
              </div>
            )}

            {m.description && <p className="whitespace-pre-line text-sm text-muted-foreground" data-testid="merchant-detail-description">{m.description}</p>}

            {m.gallery.length > 0 && (
              <div className="space-y-2" data-testid={`merchant-gallery-thumbs-${m.id}`}>
                <img src={m.gallery[shown]} alt={`${m.business_name} foto ${shown + 1}`} className="aspect-[4/3] w-full rounded-lg bg-muted object-contain" data-testid="merchant-gallery-large" />
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {m.gallery.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setShown(i)}
                      className={cn("size-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors", i === shown ? "border-primary" : "border-transparent")}
                      data-testid={`merchant-gallery-select-${i}`}
                    >
                      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {place && (
                <a
                  className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-primary/50 hover:text-primary"
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${m.address} ${m.city}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="merchant-detail-map-link"
                >
                  <MapPin className="size-4 shrink-0" /> <span className="truncate">{place}</span> <ExternalLink className="ml-auto size-3.5 shrink-0" />
                </a>
              )}
              {m.phone && (
                <a className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-primary/50 hover:text-primary" href={`tel:${m.phone}`} data-testid="merchant-detail-phone-link">
                  <Phone className="size-4" /> {m.phone}
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MerchantList({ limit }: { limit?: number }) {
  const { data, isLoading, isError } = useMerchants();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [open, setOpen] = useState<Merchant | null>(null);
  const merchants = useMemo(() => (isError ? [] : (data ?? [])), [data, isError]);
  const sectors = useMemo(() => [...new Set(merchants.map((m) => m.sector).filter(Boolean))].sort(), [merchants]);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return merchants
      .filter((m) => (!sector || m.sector === sector) && `${m.business_name} ${m.sector}`.toLowerCase().includes(needle))
      .slice(0, limit);
  }, [merchants, sector, q, limit]);

  return (
    <div className="min-w-0 space-y-4">
      {!limit && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca attività o settore…" className="h-10 pl-9" data-testid="merchant-search-input" />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {["", ...sectors].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setSector(s)}
                data-testid={`sector-filter-${s || "tutti"}`}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
            <MerchantCard key={m.id} m={m} onOpen={() => setOpen(m)} />
          ))}
        </div>
      )}
      <MerchantDetail m={open} onClose={() => setOpen(null)} />
    </div>
  );
}
