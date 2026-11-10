import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/format";

export const GALLERY_MAX = 6;

export default function GalleryUpload({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const room = GALLERY_MAX - value.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) toast.info(`Massimo ${GALLERY_MAX} foto: aggiunte le prime ${room}`);
    setBusy(true);
    try {
      const urls = await Promise.all(picked.map((f) => fileToDataUrl(f, 1000)));
      onChange([...value, ...urls]);
    } catch {
      toast.error("Una delle immagini non è leggibile");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2" data-testid="merchant-gallery">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Foto del negozio <span className="text-muted-foreground">({value.length}/{GALLERY_MAX})</span>
        </p>
        <Button type="button" variant="outline" size="sm" disabled={busy || value.length >= GALLERY_MAX} onClick={() => input.current?.click()} data-testid="merchant-gallery-add">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Aggiungi foto
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Vetrina, interno, prodotti: aiutano gli atleti a riconoscerti.</p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {value.map((src, i) => (
            <div key={src.slice(-40) + i} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted" data-testid={`merchant-gallery-item-${i}`}>
              <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                aria-label="Rimuovi foto"
                data-testid={`merchant-gallery-remove-${i}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void add(e.target.files)} data-testid="merchant-gallery-input" />
    </div>
  );
}
