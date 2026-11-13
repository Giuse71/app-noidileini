import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Download, Loader2, RotateCcw, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES } from "@/components/ProfileFields";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { dateTime, errMsg, initials } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useCategories } from "@/lib/session";
import type { AdoptCategoryResult, Athlete, ProposedCategory } from "@/lib/types";

const PROPOSED_KEY = ["categories", "proposed"];
const selectCls =
  "h-9 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function useProposed() {
  return useQuery({ queryKey: PROPOSED_KEY, queryFn: () => apiGet<ProposedCategory[]>("/admin/categories/proposed") });
}

function exportAthletes(rows: Athlete[]) {
  const head = ["Cognome", "Nome", "Email", "Categoria", "Ruolo", "Codice", "Familiari", "Stato", "Iscritto il"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [a.last_name, a.first_name, a.email, a.category_name, a.team_role, a.code, a.family_count, a.is_active ? "Attivo" : "Disattivato", dateTime(a.created_at).slice(0, 10)]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "atleti-leini-volley.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function AthletesTab() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const { data: categories = [] } = useCategories();
  const proposed = useProposed();
  const params = new URLSearchParams({ q, status });
  if (category) params.set("category", category);
  if (role) params.set("role", role);
  const list = useQuery({ queryKey: ["athletes", q, category, role, status], queryFn: () => apiGet<Athlete[]>(`/athletes?${params.toString()}`) });
  const rows = list.isError ? [] : (list.data ?? []);
  const categoryNames = useMemo(
    () => [...categories.map((c) => c.name), ...(proposed.data ?? []).map((p) => p.name)],
    [categories, proposed.data],
  );

  const toggle = useMutation({
    mutationFn: (a: Athlete) => apiPatch<Athlete>(`/admin/athletes/${a.id}/status`, { active: !a.is_active }),
    onSuccess: (a) => {
      toast.success(a.is_active ? "Atleta riattivato" : "Atleta disattivato: non può più accedere né usare la tessera");
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
      void queryClient.invalidateQueries({ queryKey: PROPOSED_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome o codice" className="w-full sm:max-w-60" data-testid="admin-athlete-search" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} aria-label="Categoria" data-testid="admin-athlete-category-filter">
          <option value="">Tutte le categorie</option>
          {categoryNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls} aria-label="Ruolo" data-testid="admin-athlete-role-filter">
          <option value="">Tutti i ruoli</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="__none">Senza ruolo</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls} aria-label="Stato" data-testid="admin-athlete-status-filter">
          <option value="active">Attivi</option>
          <option value="inactive">Disattivati</option>
          <option value="all">Tutti</option>
        </select>
        <p className="tnum text-sm text-muted-foreground" data-testid="admin-athlete-count">
          {rows.length} atleti
        </p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportAthletes(rows)} disabled={rows.length === 0} data-testid="admin-athlete-export-csv">
          <Download className="size-4" /> Esporta CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70">
              <TableHead>Atleta</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Codice</TableHead>
              <TableHead className="text-right">Familiari</TableHead>
              <TableHead>Iscritto il</TableHead>
              <TableHead className="text-right">Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground" data-testid="admin-athlete-empty">
                  {list.isLoading ? "Caricamento…" : "Nessun atleta con questi filtri"}
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.id} className={a.is_active ? "" : "opacity-60"} data-testid={`admin-athlete-row-${a.code}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-primary">
                      {a.photo ? <img src={a.photo} alt="" className="size-full object-cover" /> : initials(a.first_name, a.last_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {a.first_name} {a.last_name}
                        {!a.is_active && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">Disattivato</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {a.category_name || "—"}
                  {!a.category_id && a.category_name && <span className="ml-1 text-[10px] text-muted-foreground">(scritta)</span>}
                </TableCell>
                <TableCell data-testid={`admin-athlete-role-${a.code}`}>{a.team_role || "—"}</TableCell>
                <TableCell className="tnum font-mono text-xs">{a.code}</TableCell>
                <TableCell className="tnum text-right" data-testid={`admin-athlete-family-${a.code}`}>{a.family_count}</TableCell>
                <TableCell className="tnum text-muted-foreground">{dateTime(a.created_at).slice(0, 10)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() => {
                      const msg = a.is_active
                        ? `Disattivare ${a.first_name} ${a.last_name}? Non potrà più accedere e la sua tessera (e quelle dei familiari) non funzionerà in cassa. Lo storico resta e potrai riattivarlo.`
                        : `Riattivare ${a.first_name} ${a.last_name}?`;
                      if (window.confirm(msg)) toggle.mutate(a);
                    }}
                    data-testid={`admin-athlete-toggle-${a.code}`}
                  >
                    {a.is_active ? <UserX className="size-4 text-destructive" /> : <RotateCcw className="size-4" />}
                    {a.is_active ? "Disattiva" : "Riattiva"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Categories athletes typed themselves via "Altro": one tap adds them to the official list. */
export function ProposedCategories() {
  const proposed = useProposed();
  const adopt = useMutation({
    mutationFn: (name: string) => apiPost<AdoptCategoryResult>("/admin/categories/adopt", { name }),
    onSuccess: (r) => {
      toast.success(`"${r.category.name}" aggiunta alle categorie · ${r.moved} atleti spostati`);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const items = proposed.isError ? [] : (proposed.data ?? []);
  return (
    <section className="space-y-3 rounded-xl border border-dashed bg-gold-soft/40 p-4" data-testid="proposed-categories">
      <div>
        <h3 className="font-semibold">Categorie proposte dagli atleti</h3>
        <p className="text-sm text-muted-foreground">Scritte a mano con "Altro". Aggiungila e gli atleti che l'hanno scritta passano alla categoria ufficiale.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="proposed-categories-empty">Nessuna proposta al momento.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((p) => (
            <li key={p.name} className="flex items-center gap-3 px-4 py-2.5" data-testid={`proposed-category-${p.name}`}>
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="tnum text-xs text-muted-foreground">{p.count} {p.count === 1 ? "atleta" : "atleti"}</span>
              <Button size="sm" disabled={adopt.isPending} onClick={() => adopt.mutate(p.name)} data-testid={`proposed-category-adopt-${p.name}`}>
                {adopt.isPending && adopt.variables === p.name ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Aggiungi
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
