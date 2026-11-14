import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Car, ChevronRight, ExternalLink, Footprints, LocateFixed, Navigation, Loader2, MapPin, Phone, Search, Sparkles, Star, Tag } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import Stars from "@/components/Stars";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { errMsg, initials, pct } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useMerchants, useMe } from "@/lib/session";
import type { Favorites, Merchant } from "@/lib/types";
import { cn } from "@/lib/utils";

const FAV_KEY = ["favorites"];

interface Pos {
  lat: number;
  lng: number;
}

function distanceKm(a: Pos, b: Pos): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Google Maps directions from the current position (opens the Maps app on phones). */
function directionsUrl(m: Merchant, mode: "walking" | "driving"): string {
  const dest = m.lat != null && m.lng != null ? `${m.lat},${m.lng}` : `${m.address} ${m.city}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);

/** Athlete favourites: server list + optimistic toggle. Disabled for other roles. */
function useFavorites(enabled: boolean) {
  const q = useQuery({ queryKey: FAV_KEY, queryFn: () => apiGet<Favorites>("/athletes/me/favorites"), enabled });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      on ? apiPut<Favorites>(`/athletes/me/favorites/${id}`, {}) : apiDelete<Favorites>(`/athletes/me/favorites/${id}`),
    onMutate: ({ id, on }) => {
      const prev = queryClient.getQueryData<Favorites>(FAV_KEY);
      const ids = prev?.merchant_ids ?? [];
      queryClient.setQueryData<Favorites>(FAV_KEY, { merchant_ids: on ? [...ids, id] : ids.filter((x) => x !== id) });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(FAV_KEY, ctx.prev);
      toast.error(errMsg(e));
    },
    onSuccess: (data) => queryClient.setQueryData(FAV_KEY, data),
  });
  const ids = useMemo(() => new Set(q.data?.merchant_ids ?? []), [q.data]);
  return { ids, toggle: (id: string) => toggle.mutate({ id, on: !ids.has(id) }) };
}

function Logo({ m, className }: { m: Merchant; className: string }) {
  // logos are always shown whole (contain) on white, never cropped
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl border bg-white font-bold text-primary", className)}>
      {m.logo ? <img src={m.logo} alt={m.business_name} className="size-full object-contain p-1" /> : initials(...m.business_name.split(" "))}
    </div>
  );
}

function MerchantCard({
  m,
  onOpen,
  fav,
  onFav,
  km,
}: {
  m: Merchant;
  onOpen: () => void;
  fav?: boolean;
  onFav?: () => void;
  km?: number | null;
}) {
  return (
    <div
      className={cn(
        "group animate-fade-up flex min-w-0 items-stretch overflow-hidden rounded-xl border bg-card transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        fav && "border-gold/70 bg-gold-soft/30",
      )}
    >
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Apri dettagli di ${m.business_name}`}
      className="flex w-full min-w-0 items-center gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 active:scale-[0.99] sm:gap-4 sm:p-4"
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
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs font-medium text-primary">
          Vedi sconto e dettagli
          {km != null && (
            <span className="tnum flex items-center gap-1 text-muted-foreground" data-testid={`merchant-distance-${m.id}`}>
              <MapPin className="size-3" /> {kmLabel(km)}
            </span>
          )}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </button>
    {onFav && (
      <button
        type="button"
        onClick={onFav}
        aria-pressed={fav}
        aria-label={fav ? `Togli ${m.business_name} dai preferiti` : `Aggiungi ${m.business_name} ai preferiti`}
        className="grid w-11 shrink-0 place-items-center border-l transition-colors hover:bg-gold-soft active:scale-90"
        data-testid={`merchant-fav-${m.id}`}
      >
        <Star className={cn("size-5 transition-[color,transform] duration-200", fav ? "scale-110 fill-gold text-gold" : "text-muted-foreground")} />
      </button>
    )}
    </div>
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

            {(place || (m.lat != null && m.lng != null)) && (
              <div className="space-y-2" data-testid="merchant-directions">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Navigation className="size-4 text-primary" /> Portami qui</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["walking", "driving"] as const).map((mode) => (
                    <a
                      key={mode}
                      href={directionsUrl(m, mode)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-95"
                      data-testid={`merchant-directions-${mode}`}
                    >
                      {mode === "walking" ? <Footprints className="size-4" /> : <Car className="size-4" />}
                      {mode === "walking" ? "A piedi" : "In auto"}
                    </a>
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
  const [onlyFav, setOnlyFav] = useState(false);
  const [open, setOpen] = useState<Merchant | null>(null);
  const [here, setHere] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(false);
  const { data: me } = useMe();
  const isAthlete = me?.user.role === "athlete";
  const favs = useFavorites(isAthlete);
  const merchants = useMemo(() => (isError ? [] : (data ?? [])), [data, isError]);
  const sectors = useMemo(() => [...new Set(merchants.map((m) => m.sector).filter(Boolean))].sort(), [merchants]);
  const dist = useMemo(() => {
    const out = new Map<string, number>();
    if (here) for (const m of merchants) if (m.lat != null && m.lng != null) out.set(m.id, distanceKm(here, { lat: m.lat, lng: m.lng }));
    return out;
  }, [here, merchants]);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return merchants
      .filter((m) => (!sector || m.sector === sector) && (!onlyFav || favs.ids.has(m.id)) && `${m.business_name} ${m.sector}`.toLowerCase().includes(needle))
      .map((m, i) => ({ m, i }))
      .sort((a, b) => {
        // favourites first, then nearest (when "Vicino a me" is on), then the usual order
        const f = Number(favs.ids.has(b.m.id)) - Number(favs.ids.has(a.m.id));
        if (f) return f;
        if (here) {
          const da = dist.get(a.m.id) ?? Infinity;
          const db = dist.get(b.m.id) ?? Infinity;
          if (da !== db) return da - db;
        }
        return a.i - b.i;
      })
      .map((x) => x.m)
      .slice(0, limit);
  }, [merchants, sector, q, limit, favs.ids, here, dist, onlyFav]);

  function locate() {
    if (here) {
      setHere(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Il tuo dispositivo non permette di trovare la posizione");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      (e) => {
        setLocating(false);
        toast.error(e.code === e.PERMISSION_DENIED ? "Consenti l'accesso alla posizione per vedere i partner più vicini" : "Posizione non disponibile, riprova");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {!limit && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca attività o settore…" className="h-10 pl-9" data-testid="merchant-search-input" />
            </div>
            <button
              type="button"
              onClick={locate}
              aria-pressed={here !== null}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors active:scale-95",
                here ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
              )}
              data-testid="merchant-near-me-button"
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              <span>Vicino a me</span>
            </button>
          </div>
          {isAthlete && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="merchant-fav-hint">
              <Star className="size-3.5 fill-gold text-gold" /> Tocca la stella per mettere un partner tra i preferiti: comparirà sempre in cima
            </p>
          )}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {isAthlete && (
              <button
                type="button"
                onClick={() => setOnlyFav(!onlyFav)}
                aria-pressed={onlyFav}
                data-testid="sector-filter-preferiti"
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  onlyFav ? "border-gold bg-gold text-navy" : "bg-card hover:border-gold",
                )}
              >
                <Star className={cn("size-3.5", onlyFav ? "fill-navy" : "fill-gold text-gold")} /> Preferiti ({favs.ids.size})
              </button>
            )}
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
          {onlyFav ? "Nessun preferito ancora: tocca la stella su un partner per salvarlo" : "Nessun commerciante convenzionato da mostrare"}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="merchant-list">
          {filtered.map((m) => (
            <MerchantCard
              key={m.id}
              m={m}
              onOpen={() => setOpen(m)}
              fav={favs.ids.has(m.id)}
              onFav={isAthlete ? () => favs.toggle(m.id) : undefined}
              km={here ? (dist.get(m.id) ?? null) : null}
            />
          ))}
        </div>
      )}
      <MerchantDetail m={open} onClose={() => setOpen(null)} />
    </div>
  );
}
