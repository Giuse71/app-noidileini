import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LEINI, OSM_ATTRIBUTION, OSM_TILES } from "@/components/PartnersMap";
import { apiGet } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { GeocodeOut } from "@/lib/types";

const icon = L.divIcon({ className: "", html: '<div class="lv-pin" style="position:relative">Qui</div>', iconSize: [50, 30], iconAnchor: [25, 32] });

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ at }: { at: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (at) map.setView(at, Math.max(map.getZoom(), 16));
  }, [at, map]);
  return null;
}

export default function LocationPicker({
  lat,
  lng,
  address,
  city,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  address: string;
  city: string;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const pos: [number, number] | null = lat !== null && lng !== null ? [lat, lng] : null;
  const find = useMutation({
    mutationFn: () => apiGet<GeocodeOut>(`/geocode?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`),
    onSuccess: (r) => (r.found ? onChange(r.lat, r.lng) : toast.error("Indirizzo non trovato: posiziona il segnaposto toccando la mappa")),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-2" data-testid="location-picker">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="size-4 text-primary" /> Posizione sulla mappa
        </p>
        <Button type="button" variant="outline" size="sm" disabled={find.isPending || address.trim().length < 3} onClick={() => find.mutate()} data-testid="location-find-button">
          {find.isPending && <Loader2 className="size-4 animate-spin" />} Trova dall'indirizzo
        </Button>
      </div>
      <div className="relative isolate z-0 h-56 overflow-hidden rounded-xl border">
        <MapContainer center={pos ?? LEINI} zoom={pos ? 16 : 14} className="size-full">
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILES} />
          <ClickToPlace onPick={(a, b) => onChange(a, b)} />
          <Recenter at={pos} />
          {pos && (
            <Marker
              position={pos}
              icon={icon}
              draggable
              eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="location-status">
        {pos ? "Trascina il segnaposto o tocca la mappa per correggerlo. Salva per confermare." : "Nessuna posizione: verrà calcolata dall'indirizzo al salvataggio, oppure tocca la mappa."}
      </p>
    </div>
  );
}
