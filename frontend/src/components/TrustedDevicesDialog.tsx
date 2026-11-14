import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiGet } from "@/lib/api";
import { dateTime, errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { TrustedDevice } from "@/lib/types";

const KEY = ["trusted-devices"];

/** Devices that skip the email login code (300 days): the user can see and remove each one. */
export default function TrustedDevicesDialog() {
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<TrustedDevice[]>("/auth/devices"), enabled: open });
  const revoke = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/devices/${id}`),
    onSuccess: () => {
      toast.success("Dispositivo rimosso: al prossimo accesso chiederà il codice");
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const items = list.data ?? [];
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Dispositivi fidati" onClick={() => setOpen(true)} data-testid="trusted-devices-button">
        <Smartphone className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" data-testid="trusted-devices-dialog">
          <DialogHeader>
            <DialogTitle>Dispositivi fidati</DialogTitle>
            <DialogDescription>Su questi dispositivi non chiediamo il codice email per 300 giorni. Rimuovi quelli che non riconosci o non usi più.</DialogDescription>
          </DialogHeader>
          {list.isLoading ? (
            <Loader2 className="mx-auto size-5 animate-spin text-primary" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="trusted-devices-empty">Nessun dispositivo ricordato.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {items.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5" data-testid={`trusted-device-${d.id}`}>
                  <Smartphone className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {d.label} {d.is_current && <span className="ml-1 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold text-gold-ink">questo</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Usato {dateTime(d.last_used_at)} · scade {dateTime(d.expires_at).slice(0, 10)}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Rimuovi dispositivo" disabled={revoke.isPending} onClick={() => revoke.mutate(d.id)} data-testid={`trusted-device-remove-${d.id}`}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
