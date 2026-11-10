import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const REGION_ID = "lv-qr-region";

export default function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const scanner = useRef<Html5Qrcode | null>(null);
  const handled = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  async function stop() {
    const s = scanner.current;
    scanner.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setActive(false);
  }

  async function start() {
    setError("");
    handled.current = false;
    setActive(true);
    try {
      const s = new Html5Qrcode(REGION_ID);
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (handled.current) return;
          handled.current = true;
          void stop();
          onResult(text);
        },
        () => undefined,
      );
    } catch {
      setError("Fotocamera non disponibile o permesso negato. Usa il codice manuale.");
      await stop();
    }
  }

  useEffect(() => () => void stop(), []);

  return (
    <div className="space-y-3">
      <div
        className={
          active
            ? "overflow-hidden rounded-xl border-2 border-primary bg-black shadow-lg"
            : "hidden"
        }
      >
        <div id={REGION_ID} data-testid="qr-scanner-region" />
      </div>
      {!active && (
        <div className="grid place-items-center rounded-xl border border-dashed bg-muted/50 px-4 py-10 text-center">
          <Camera className="size-8 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Inquadra il QR sulla tessera digitale dell'atleta</p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" data-testid="qr-scanner-error">
          {error}
        </p>
      )}
      {active ? (
        <Button variant="outline" className="w-full" onClick={() => void stop()} data-testid="qr-scanner-stop">
          <CameraOff className="size-4" /> Ferma fotocamera
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void start()} data-testid="qr-scanner-start">
          <Camera className="size-4" /> Avvia scansione
        </Button>
      )}
    </div>
  );
}
