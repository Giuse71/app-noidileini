import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Minus, Move, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const VIEW = 280; // on-screen crop frame width (px)

interface Pos {
  x: number;
  y: number;
}

/** Lets people zoom and drag their photo inside the frame (round, square or landscape) before saving it. */
export default function PhotoCropDialog({
  file,
  onCancel,
  onDone,
  aspect = 1,
  round = true,
  outWidth = 480,
}: {
  file: File | null;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
  /** width / height of the saved photo */
  aspect?: number;
  round?: boolean;
  outWidth?: number;
}) {
  const VH = Math.round(VIEW / aspect);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const drag = useRef<{ start: Pos; from: Pos } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = img ? Math.max(VIEW / img.naturalWidth, VH / img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : VIEW;
  const h = img ? img.naturalHeight * scale : VH;
  // keep the frame always covered by the photo
  const clamp = (p: Pos): Pos => ({
    x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, p.x)),
    y: Math.max(-(h - VH) / 2, Math.min((h - VH) / 2, p.y)),
  });
  const view = clamp(pos);

  function onDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: { x: e.clientX, y: e.clientY }, from: view };
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setPos(clamp({ x: d.from.x + e.clientX - d.start.x, y: d.from.y + e.clientY - d.start.y }));
  }

  function save() {
    if (!img) return;
    const k = outWidth / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = Math.round(VH * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (VIEW / 2 + view.x - w / 2) * k, (VH / 2 + view.y - h / 2) * k, w * k, h * k);
    onDone(canvas.toDataURL("image/jpeg", 0.88));
  }

  const setZoomClamped = (z: number) => setZoom(Math.min(4, Math.max(1, Math.round(z * 100) / 100)));

  return (
    <Dialog open={file !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm" data-testid="photo-crop-dialog">
        <DialogHeader>
          <DialogTitle>Sistema la foto</DialogTitle>
          <DialogDescription>Trascina per spostarla, usa lo zoom per ingrandirla.</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-muted select-none active:cursor-grabbing"
            style={{ width: VIEW, height: VH }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => setZoomClamped(zoom - e.deltaY * 0.002)}
            data-testid="photo-crop-area"
          >
            {img && (
              <img
                src={img.src}
                alt="Anteprima"
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ width: w, height: h, left: VIEW / 2 + view.x - w / 2, top: VH / 2 + view.y - h / 2 }}
              />
            )}
            {/* guide: what will be visible once saved */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 ring-2 ring-white/90",
                round ? "rounded-full shadow-[0_0_0_999px_rgba(15,23,42,0.45)]" : "rounded-xl",
              )}
            />
            <Move className="pointer-events-none absolute bottom-2 right-2 size-4 text-white/80" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Riduci" onClick={() => setZoomClamped(zoom - 0.2)} data-testid="photo-crop-zoom-out">
            <Minus className="size-4" />
          </Button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary"
            aria-label="Zoom"
            data-testid="photo-crop-zoom"
          />
          <Button type="button" variant="outline" size="icon" aria-label="Ingrandisci" onClick={() => setZoomClamped(zoom + 0.2)} data-testid="photo-crop-zoom-in">
            <Plus className="size-4" />
          </Button>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} data-testid="photo-crop-cancel">Annulla</Button>
          <Button type="button" onClick={save} disabled={!img} data-testid="photo-crop-save">Usa questa foto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
