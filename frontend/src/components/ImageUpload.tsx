import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/format";
import { tooHeavy, useImageLimitMb } from "@/lib/session";
import { cn } from "@/lib/utils";
import PhotoCropDialog from "@/components/PhotoCropDialog";

export default function ImageUpload({
  value,
  onChange,
  label,
  testid,
  round = false,
  placeholder,
  maxPx,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  testid: string;
  round?: boolean;
  placeholder?: string;
  /** longest side after resize; default keeps small profile-sized images */
  maxPx?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const limitMb = useImageLimitMb();
  const [busy, setBusy] = useState(false);
  // round (profile) photos go through the crop dialog so people can frame them
  const [cropping, setCropping] = useState<File | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un file immagine");
      return;
    }
    if (tooHeavy(file, limitMb)) {
      toast.error(`Immagine troppo pesante: massimo ${limitMb} MB`);
      if (input.current) input.current.value = "";
      return;
    }
    if (round) {
      setCropping(file);
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file, maxPx));
    } catch {
      toast.error("Immagine non leggibile");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "grid size-20 shrink-0 place-items-center overflow-hidden border bg-muted text-lg font-semibold text-muted-foreground",
          round ? "rounded-full" : "rounded-xl",
        )}
        data-testid={`${testid}-preview`}
      >
        {value ? (
          <img src={value} alt={label} className={cn("size-full", round ? "object-cover" : "object-contain bg-white")} />
        ) : (
          (placeholder ?? <ImagePlus className="size-6" />)
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy} data-testid={`${testid}-button`}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {value ? "Cambia" : "Carica"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} data-testid={`${testid}-remove`}>
              <Trash2 className="size-4" />
              Rimuovi
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid={`${testid}-limit`}>Max {limitMb} MB</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid={`${testid}-input`}
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </div>
      {round && (
        <PhotoCropDialog
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(v) => {
            onChange(v);
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}
