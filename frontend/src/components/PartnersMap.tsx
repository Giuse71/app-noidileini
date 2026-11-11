import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Stars from "@/components/Stars";
import { pct } from "@/lib/format";
import { useMerchants } from "@/lib/session";
import type { Merchant } from "@/lib/types";

export const LEINI: [number, number] = [45.1836, 7.7155];
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const pin = (label: string) =>
  L.divIcon({ className: "", html: `<div class="lv-pin" style="position:relative">${label}</div>`, iconSize: [50, 30], iconAnchor: [25, 32], popupAnchor: [0, -30] });
const meIcon = L.divIcon({ className: "", html: '<div class="lv-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function km(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function FlyTo({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo(to, 15, { duration: 0.8 });
  }, [to, map]);
  return null;
}

type Placed = Merchant & { lat: number; lng: number };

export default function PartnersMap() {
  const { data, isError } = useMerchants();
  const placed = useMemo(() => (isError ? [] : (data ?? [])).filter((m): m is Placed => m.lat !== null && m.lng !== null), [data, isError]);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!navigator.geolocation) return toast.error("Posizione non disponibile su questo dispositivo");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setMe(pos);
        setFocus(pos);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Permesso posizione negato");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const list = useMemo(() => (me ? [...placed].sort((a, b) => km(me, [a.lat, a.lng]) - km(me, [b.lat, b.lng])) : placed), [me, placed]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative isolate z-0 h-[420px] overflow-hidden rounded-xl border lg:h-[560px]" data-testid="partners-map">
        <MapContainer center={LEINI} zoom={14} className="size-full" scrollWheelZoom>
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILES} />
          <FlyTo to={focus} />
          {me && <Marker position={me} icon={meIcon} />}
          {placed.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={pin(`-${pct(m.discount_percent)}`)}>
              <Popup>
                <div className="space-y-1 font-sans" data-testid={`map-popup-${m.id}`}>
                  <p className="text-sm font-semibold">{m.business_name}</p>
                  {m.sector && <p className="text-xs text-slate-500">{m.sector}</p>}
                  {m.rating_count > 0 && (
                    <p className="flex items-center gap-1 text-xs">
                      <Stars value={m.rating_avg} size="size-3" /> {m.rating_avg.toFixed(1).replace(".", ",")}
                    </p>
                  )}
                  {m.promo_active && <p className="text-xs font-semibold text-amber-700">★ {m.promo_title}</p>}
                  <p className="text-xs">{[m.address, m.city].filter(Boolean).join(", ")}</p>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" className="text-xs font-semibold">
                    Indicazioni stradali →
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <Button size="sm" className="absolute right-3 top-3 z-[1000] shadow-lg" onClick={locate} disabled={locating} data-testid="map-locate-button">
          <LocateFixed className="size-4" /> {locating ? "Cerco…" : "Vicino a me"}
        </Button>
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto" data-testid="map-partner-list">
        {list.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nessun partner con posizione</p>}
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setFocus([m.lat, m.lng])}
            className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40"
            data-testid={`map-list-item-${m.id}`}
          >
            <span className="tnum grid h-7 min-w-12 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-white">-{pct(m.discount_percent)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.business_name}</span>
              <span className="block truncate text-xs text-muted-foreground">{m.address}</span>
            </span>
            {me && (
              <span className="tnum flex shrink-0 items-center gap-1 text-xs font-medium text-primary" data-testid={`map-distance-${m.id}`}>
                <Navigation className="size-3" />
                {km(me, [m.lat, m.lng]).toFixed(1).replace(".", ",")} km
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
