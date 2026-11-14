import { useState } from "react";
import { AREA_LABELS } from "@/components/SupervisorTab";
import { useMe } from "@/lib/session";
import type { BoardArea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { dateTime, errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { AdminUser, InviteResult, NewAdminIn } from "@/lib/types";

const KEY = ["admins"];

export default function BoardTab() {
  const list = useQuery({ queryKey: KEY, queryFn: () => apiGet<AdminUser[]>("/admin/admins") });
  const rows = list.isError ? [] : (list.data ?? []);
  const [email, setEmail] = useState("");
  const { data: me } = useMe();
  const grantable = (me?.user.areas ?? []) as BoardArea[];
  const [areas, setAreas] = useState<BoardArea[] | null>(null);
  const chosen = areas ?? grantable;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: KEY });

  const add = useMutation({
    mutationFn: (b: NewAdminIn) => apiPost<AdminUser>("/admin/admins", b),
    onSuccess: (u) => {
      toast.success(`${u.email} aggiunto: riceverà l'email per scegliere la password`);
      setEmail("");
      refresh();
    },
    onError: (e) => {
      toast.error(errMsg(e));
      refresh();
    },
  });
  const invite = useMutation({
    mutationFn: (id: string) => apiPost<InviteResult>(`/admin/admins/${id}/invite`),
    onSuccess: (r) => toast.success(`Invito reinviato a ${r.sent_to}`),
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/admins/${id}`),
    onSuccess: () => {
      toast.success("Membro rimosso dal direttivo");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Membri del direttivo</h2>
        <p className="text-sm text-muted-foreground">
          Ogni membro ha il proprio accesso e vede solo le aree scelte qui (puoi dare solo aree che hai anche tu). Riceve un'email per scegliere la sua password.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ email, areas: chosen });
        }}
      >
        <div className="flex basis-full flex-wrap gap-2 sm:order-last" data-testid="board-new-areas">
          {grantable.map((a) => {
            const on = chosen.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                onClick={() => setAreas(on ? chosen.filter((x) => x !== a) : [...chosen, a])}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95", on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
                data-testid={`board-new-area-${a}`}
              >
                {AREA_LABELS[a]}
              </button>
            );
          })}
        </div>
        <Input type="email" required placeholder="email del nuovo membro" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="board-email-input" />
        <Button type="submit" disabled={add.isPending} data-testid="board-add-button">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Aggiungi al direttivo
        </Button>
      </form>
      <ul className="divide-y rounded-xl border bg-card" data-testid="board-list">
        {rows.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`board-member-${u.email}`}>
            <span className="grid size-9 place-items-center rounded-full bg-accent text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {u.email} {u.is_superadmin && <span className="ml-1 rounded-full bg-navy px-2 py-0.5 text-xs font-semibold text-gold">supervisore</span>} {u.is_me && <span className="ml-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">tu</span>}
              </p>
              {u.created_at && <p className="text-xs text-muted-foreground">Dal {dateTime(u.created_at).slice(0, 10)}</p>}
            </div>
            {!u.is_me && !u.is_superadmin && (
              <>
                <Button variant="ghost" size="sm" disabled={invite.isPending} onClick={() => invite.mutate(u.id)} data-testid={`board-invite-${u.email}`}>
                  <Mail className="size-4" /> Reinvia invito
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Rimuovere ${u.email} dal direttivo? Non potrà più accedere.`)) remove.mutate(u.id);
                  }}
                  data-testid={`board-remove-${u.email}`}
                >
                  <Trash2 className="size-4 text-destructive" /> Rimuovi
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
