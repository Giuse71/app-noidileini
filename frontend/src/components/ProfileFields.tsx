import { useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import GalleryUpload from "@/components/GalleryUpload";
import LocationPicker from "@/components/LocationPicker";
import { initials } from "@/lib/format";
import { useCategories } from "@/lib/session";
import type { AthleteUpdate, MerchantUpdate } from "@/lib/types";

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const OTHER = "__other";
export const ROLES = ["Palleggiatore", "Schiacciatore", "Opposto", "Centrale", "Libero", "Allenatore", "Dirigente", "Accompagnatore"];

export function AthleteFields({ value, onChange }: { value: AthleteUpdate; onChange: (v: AthleteUpdate) => void }) {
  const { data: categories = [] } = useCategories();
  const [other, setOther] = useState(!value.category_id && value.category_custom !== "");
  const set = <K extends keyof AthleteUpdate>(k: K, v: AthleteUpdate[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <ImageUpload
        value={value.photo}
        onChange={(v) => set("photo", v)}
        label="Foto profilo"
        testid="athlete-photo"
        round
        placeholder={initials(value.first_name, value.last_name) || undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="ath-first">
          <Input id="ath-first" required value={value.first_name} onChange={(e) => set("first_name", e.target.value)} data-testid="athlete-first-name-input" />
        </Field>
        <Field label="Cognome" htmlFor="ath-last">
          <Input id="ath-last" required value={value.last_name} onChange={(e) => set("last_name", e.target.value)} data-testid="athlete-last-name-input" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria di appartenenza" htmlFor="ath-cat">
          {/* native select: opens the phone's own scrollable picker and never covers the form */}
          <select
            id="ath-cat"
            value={other ? OTHER : value.category_id}
            onChange={(e) => {
              const v = e.target.value;
              setOther(v === OTHER);
              onChange({ ...value, category_id: v === OTHER ? "" : v, category_custom: v === OTHER ? value.category_custom : "" });
            }}
            className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            data-testid="athlete-category-select"
          >
            <option value="" disabled>
              Seleziona la categoria
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} data-testid={`athlete-category-option-${c.id}`}>
                {c.name}
              </option>
            ))}
            <option value={OTHER} data-testid="athlete-category-option-other">
              Altro: la scrivo io
            </option>
          </select>
          {other && (
            <Input
              autoFocus
              required
              maxLength={60}
              placeholder="Es. Under 13 femminile"
              value={value.category_custom}
              onChange={(e) => set("category_custom", e.target.value)}
              className="mt-2 animate-fade-up"
              data-testid="athlete-category-custom-input"
            />
          )}
        </Field>
        <Field label="Ruolo (facoltativo)" htmlFor="ath-role">
          <Input
            id="ath-role"
            list="ath-role-options"
            maxLength={60}
            placeholder="Es. Palleggiatore, Libero, Allenatore"
            value={value.team_role}
            onChange={(e) => set("team_role", e.target.value)}
            data-testid="athlete-role-input"
          />
          <datalist id="ath-role-options">
            {ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      </div>
    </div>
  );
}

export function MerchantFields({ value, onChange, showMap = true }: { value: MerchantUpdate; onChange: (v: MerchantUpdate) => void; showMap?: boolean }) {
  const set = <K extends keyof MerchantUpdate>(k: K, v: MerchantUpdate[K]) => onChange({ ...value, [k]: v });
  const text = (k: Exclude<keyof MerchantUpdate, "logo" | "discount_percent" | "promo_description" | "gallery" | "lat" | "lng">, label: string, opts: { required?: boolean; hint?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={`m-${k}`} hint={opts.hint}>
      <Input
        id={`m-${k}`}
        type={opts.type ?? "text"}
        required={opts.required}
        value={value[k]}
        onChange={(e) => set(k, e.target.value)}
        data-testid={`merchant-${k.replace(/_/g, "-")}-input`}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <ImageUpload value={value.logo} onChange={(v) => set("logo", v)} label="Logo aziendale" testid="merchant-logo" />
      <div className="grid gap-4 sm:grid-cols-2">
        {text("business_name", "Nome attività / insegna", { required: true })}
        {text("legal_name", "Ragione sociale")}
        {text("vat_number", "Partita IVA", { required: true, hint: "11 cifre (es. 01234567890)" })}
        {text("sector", "Settore", { hint: "Es. Pizzeria, Bar, Ottico, Abbigliamento" })}
        {text("address", "Indirizzo")}
        {text("city", "Comune")}
        {text("phone", "Telefono", { type: "tel" })}
        {text("email", "Email pubblica", { type: "email" })}
        {text("website", "Sito web")}
        <Field label="Sconto convenzione (%)" htmlFor="m-discount" hint="Applicato automaticamente a ogni transazione">
          <Input
            id="m-discount"
            type="number"
            min={0}
            max={100}
            step={0.5}
            required
            value={value.discount_percent}
            onChange={(e) => set("discount_percent", Number(e.target.value))}
            data-testid="merchant-discount-input"
          />
        </Field>
      </div>
      {showMap && (
        <LocationPicker lat={value.lat} lng={value.lng} address={value.address} city={value.city} onChange={(lat, lng) => onChange({ ...value, lat, lng })} />
      )}
      <Field label="Descrizione dell'attività" htmlFor="m-description">
        <Textarea id="m-description" rows={3} value={value.description} onChange={(e) => set("description", e.target.value)} data-testid="merchant-description-input" />
      </Field>
      <GalleryUpload value={value.gallery} onChange={(v) => set("gallery", v)} />
      <div className="space-y-4 rounded-xl border border-gold/40 bg-gold-soft/60 p-4" data-testid="merchant-promo-section">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-gold-ink" />
          <p className="text-sm font-semibold text-gold-ink">Promozione del mese (facoltativa)</p>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">Gli atleti la vedono in evidenza sulla tessera nelle date indicate. Lo sconto in cassa resta quello della convenzione.</p>
        {text("promo_title", "Titolo", { hint: "Es. Pizza + bibita a 10 € il martedì" })}
        <Field label="Descrizione" htmlFor="m-promo-desc">
          <Textarea id="m-promo-desc" rows={2} value={value.promo_description} onChange={(e) => set("promo_description", e.target.value)} data-testid="merchant-promo-description-input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("promo_start", "Valida dal", { type: "date" })}
          {text("promo_end", "Valida fino al", { type: "date" })}
        </div>
        {(value.promo_title || value.promo_start || value.promo_end) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...value, promo_title: "", promo_description: "", promo_start: "", promo_end: "" })}
            data-testid="merchant-promo-clear"
          >
            Rimuovi promozione
          </Button>
        )}
      </div>
    </div>
  );
}
