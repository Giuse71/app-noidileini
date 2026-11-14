import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, ShieldCheck, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { AccountOut, BoardArea } from "@/lib/types";
import { cn } from "@/lib/utils";

export const AREA_LABELS: Record<BoardArea, string> = {
  athletes: "Atleti",
  merchants: "Commercianti",
  reports: "Report e transazioni",
  content: "Associazione, categorie, notizie",
  board: "Membri del Direttivo",
};
const AREAS = Object.keys(AREA_LABELS) as BoardArea[];
const KEY = ["supervisor-accounts"];

function useAccounts(role: "admin" | "merchant" | "athlete") {
  return useQuery({ queryKey: [...KEY, role], queryFn: () => apiGet<AccountOut[]>(`/admin/supervisor/accounts?role=${role}`) });
}

function useStatus() {
  return useMutation({
    mutationFn: (a: AccountOut) => apiPatch<AccountOut>(`/admin/supervisor/accounts/${a.id}/status`, { active: !a.is_active }),
    onSuccess: (a) => {
      toast.success(a.is_active ? "Account sbloccato" : "Account bloccato: non può più accedere");
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

function StatusButton({ a, status }: { a: AccountOut; status: ReturnType<typeof useStatus> }) {
  if (a.is_superadmin) return <span className="text-xs font-semibold text-primary">Supervisore</span>;
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={status.isPending}
      onClick={() => window.confirm(a.is_active ? `Bloccare ${a.email}?` : `Sbloccare ${a.email}?`) && status.mutate(a)}
      data-testid={`supervisor-status-${a.id}`}
    >
      {a.is_active ? <Lock className="size-4 text-destructive" /> : <Unlock className="size-4" />} {a.is_active ? "Blocca" : "Sblocca"}
    </Button>
  );
}

function BoardPermissions() {
  const list = useAccounts("admin");
  const status = useStatus();
  const save = useMutation({
    mutationFn: ({ id, areas }: { id: string; areas: BoardArea[] }) => apiPut<AccountOut>(`/admin/supervisor/accounts/${id}/permissions`, { areas }),
    onSuccess: () => {
      toast.success("Permessi aggiornati");
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <section className="space-y-3" data-testid="supervisor-board">
      <h2 className="font-semibold">Direttivo e permessi</h2>
      <p className="text-sm text-muted-foreground">Tocca un'area per accenderla o spegnerla: il membro vedrà solo le aree attive.</p>
      <ul className="space-y-3">
        {(list.data ?? []).map((a) => (
          <li key={a.id} className={cn("rounded-xl border bg-card p-4", !a.is_active && "opacity-60")} data-testid={`supervisor-admin-${a.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 break-all font-medium">{a.email}</p>
              <StatusButton a={a} status={status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {AREAS.map((area) => {
                const on = a.areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    disabled={a.is_superadmin || save.isPending}
                    aria-pressed={on}
                    onClick={() => save.mutate({ id: a.id, areas: on ? a.areas.filter((x) => x !== area) as BoardArea[] : [...a.areas, area] as BoardArea[] })}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 disabled:cursor-default",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/50",
                    )}
                    data-testid={`supervisor-area-${a.id}-${area}`}
                  >
                    {AREA_LABELS[area]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccountsList({ role, title }: { role: "merchant" | "athlete"; title: string }) {
  const list = useAccounts(role);
  const status = useStatus();
  const [q, setQ] = useState("");
  const rows = (list.data ?? []).filter((a) => `${a.email} ${a.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="space-y-3" data-testid={`supervisor-${role}s`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title} ({list.data?.length ?? 0})</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca…"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56 md:text-sm"
          data-testid={`supervisor-${role}-search`}
        />
      </div>
      <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-xl border bg-card">
        {rows.map((a) => (
          <li key={a.id} className={cn("flex items-center gap-3 px-4 py-2.5", !a.is_active && "opacity-60")} data-testid={`supervisor-account-${a.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name || a.email}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}{a.is_active ? "" : " · bloccato"}</p>
            </div>
            <StatusButton a={a} status={status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SupervisorTab() {
  return (
    <div className="space-y-8">
      <p className="flex items-start gap-2 rounded-xl bg-navy p-4 text-sm text-blue-100">
        <ShieldCheck className="size-5 shrink-0 text-gold" />
        Area del supervisore: controllo completo su permessi del Direttivo e su tutti gli account. Ogni modifica viene registrata.
      </p>
      <BoardPermissions />
      <div className="grid gap-8 lg:grid-cols-2">
        <AccountsList role="merchant" title="Account commercianti" />
        <AccountsList role="athlete" title="Account atleti" />
      </div>
    </div>
  );
}
