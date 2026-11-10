import { useEffect, useState } from "react";
import { Check, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Captured once at module load so the event is not missed before the card mounts.
let deferred: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function InstallCard() {
  const [installed, setInstalled] = useState(isStandalone);
  const [help, setHelp] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setHelp(true);
  }

  if (installed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="install-card-installed">
        <Check className="size-4" /> Tessera salvata sul telefono
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3" data-testid="install-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <Smartphone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Tessera sul telefono</p>
        <p className="text-xs text-muted-foreground">Aggiungila alla schermata Home: il QR si apre al volo in cassa</p>
      </div>
      <Button size="sm" onClick={() => void install()} data-testid="install-card-button">
        Salva
      </Button>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-sm" data-testid="install-help-dialog">
          <DialogHeader>
            <DialogTitle>Aggiungi alla schermata Home</DialogTitle>
            <DialogDescription>Così apri la tessera con un tocco, come un'app.</DialogDescription>
          </DialogHeader>
          {isIos ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Apri questa pagina con <strong>Safari</strong>
              </li>
              <li>
                Tocca <Share className="inline size-4 text-primary" /> <strong>Condividi</strong>
              </li>
              <li>
                Scegli <strong>Aggiungi alla schermata Home</strong> e conferma
              </li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Apri il menu <strong>⋮</strong> del browser (Chrome)
              </li>
              <li>
                Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>
              </li>
              <li>Conferma: troverai l'icona del Leinì Volley tra le tue app</li>
            </ol>
          )}
          <Button variant="outline" onClick={() => setHelp(false)} data-testid="install-help-close">
            Ho capito
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
