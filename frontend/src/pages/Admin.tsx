import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgePercent, Download, Euro, Loader2, Plus, Receipt, Store, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ImageUpload from "@/components/ImageUpload";
import { Field } from "@/components/ProfileFields";
import StatCard from "@/components/StatCard";
import TransactionsTable from "@/components/TransactionsTable";
import { AdminMerchantsTab, ReportsTab } from "@/components/AdminExtras";
import RankingTab from "@/components/RankingTab";
import BoardTab from "@/components/BoardTab";
import { AthletesTab, ProposedCategories } from "@/components/AthletesAdmin";
import BachecaTab, { EmailTestCard } from "@/components/BachecaTab";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { dateTime, errMsg, eur, initials, totals } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useAssociation, useCategories, useMerchants } from "@/lib/session";
import type { Association, Athlete, Category, Transaction } from "@/lib/types";

const EMPTY_ASSOC: Association = {
  name: "", logo: null, address: "", city: "", vat_number: "", fiscal_code: "", email: "", phone: "", website: "", description: "", convention_rules: "",
  hero_image: null, home_badge: "", home_title: "", home_subtitle: "", step1_title: "", step1_text: "", step2_title: "", step2_text: "",
  step3_title: "", step3_text: "", partners_title: "", partners_subtitle: "",
};

function useAllTransactions() {
  return useQuery({ queryKey: ["transactions", "all"], queryFn: () => apiGet<Transaction[]>("/admin/transactions") });
}

function exportCsv(rows: Transaction[]) {
  const head = ["Data", "Atleta", "Codice", "Categoria", "Commerciante", "Lordo", "Sconto %", "Sconto €", "Pagato", "Nota"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = rows.map((r) =>
    [dateTime(r.created_at), r.athlete_name, r.athlete_code, r.category_name, r.merchant_name, num(r.amount), r.discount_percent, num(r.discount_amount), num(r.final_amount), r.note].map(esc).join(";"),
  );
  const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transazioni-leini-volley.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Overview() {
  const tx = useAllTransactions();
  const { data: merchants = [] } = useMerchants();
  const athletes = useQuery({ queryKey: ["athletes", ""], queryFn: () => apiGet<Athlete[]>("/athletes?q=") });
  const rows = useMemo(() => (tx.isError ? [] : (tx.data ?? [])), [tx.data, tx.isError]);
  const t = totals(rows);
  const perMerchant = useMemo(() => {
    const map = new Map<string, { name: string; count: number; amount: number; discount: number }>();
    for (const r of rows) {
      const cur = map.get(r.merchant_id) ?? { name: r.merchant_name, count: 0, amount: 0, discount: 0 };
      cur.count += 1;
      cur.amount += r.amount;
      cur.discount += r.discount_amount;
      map.set(r.merchant_id, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Transazioni" value={String(t.count)} icon={Receipt} testid="admin-stat-count" />
        <StatCard label="Volume generato" value={eur(t.amount)} icon={Euro} testid="admin-stat-amount" />
        <StatCard label="Sconti erogati" value={eur(t.discount)} icon={BadgePercent} accent testid="admin-stat-discount" />
        <StatCard label="Atleti · Partner" value={`${athletes.data?.length ?? 0} · ${merchants.length}`} icon={Users} testid="admin-stat-members" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <h2 className="font-semibold">Volume per partner</h2>
          <div className="divide-y rounded-xl border bg-card" data-testid="admin-per-merchant">
            {perMerchant.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nessun dato</p>}
            {perMerchant.map(([id, m]) => {
              const max = perMerchant[0][1].amount || 1;
              return (
                <div key={id} className="space-y-1.5 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{m.name}</span>
                    <span className="tnum">{eur(m.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(m.amount / max) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.count} transazioni · sconti {eur(m.discount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold">Ultime transazioni</h2>
          <TransactionsTable rows={rows.slice(0, 6)} testid="admin-recent-transactions" />
        </div>
      </div>
    </div>
  );
}

function TransactionsReport() {
  const tx = useAllTransactions();
  const { data: merchants = [] } = useMerchants();
  const [merchantId, setMerchantId] = useState("all");
  const rows = (tx.isError ? [] : (tx.data ?? [])).filter((r) => merchantId === "all" || r.merchant_id === merchantId);
  const t = totals(rows);
  const labels: Record<string, string> = { all: "Tutti i commercianti", ...Object.fromEntries(merchants.map((m) => [m.id, m.business_name])) };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={merchantId} onValueChange={(v: string) => setMerchantId(v)}>
          <SelectTrigger className="w-64" data-testid="report-merchant-filter">
            <SelectValue>{(v) => labels[v as string]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i commercianti</SelectItem>
            {merchants.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="tnum text-sm text-muted-foreground" data-testid="report-summary">
          {t.count} transazioni · lordo {eur(t.amount)} · sconti {eur(t.discount)} · netto {eur(t.final)}
        </p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportCsv(rows)} disabled={rows.length === 0} data-testid="report-export-csv">
          <Download className="size-4" /> Esporta CSV
        </Button>
      </div>
      <TransactionsTable rows={rows} testid="admin-transactions" />
    </div>
  );
}

function AdminMerchantsTabWrapper() {
  const tx = useAllTransactions();
  return <AdminMerchantsTab transactions={tx.isError ? [] : (tx.data ?? [])} />;
}

function CategoriesTab() {
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState("");
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["categories"] });
  const add = useMutation({
    mutationFn: (n: string) => apiPost<Category>("/categories", { name: n }),
    onSuccess: () => {
      setName("");
      toast.success("Categoria aggiunta");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/categories/${id}`),
    onSuccess: () => {
      toast.success("Categoria eliminata");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="max-w-xl space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate(name.trim());
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuova categoria (es. Under 13)" data-testid="category-name-input" />
        <Button type="submit" disabled={add.isPending} data-testid="category-add-button">
          <Plus className="size-4" /> Aggiungi
        </Button>
      </form>
      <ProposedCategories />
      <ul className="divide-y rounded-xl border bg-card" data-testid="category-list">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-2.5" data-testid={`category-item-${c.id}`}>
            <span className="font-medium">{c.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (window.confirm(`Eliminare la categoria "${c.name}"? Gli atleti associati resteranno senza categoria.`)) del.mutate(c.id);
              }}
              data-testid={`category-delete-${c.id}`}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssociationForm({ initial }: { initial: Association }) {
  const [form, setForm] = useState<Association>(initial);
  const save = useMutation({
    mutationFn: (b: Association) => apiPut<Association>("/association", b),
    onSuccess: () => {
      toast.success("Dati associazione salvati");
      void queryClient.invalidateQueries({ queryKey: ["association"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const set = <K extends keyof Association>(k: K, v: Association[K]) => setForm({ ...form, [k]: v });
  const text = (k: Exclude<keyof Association, "logo" | "hero_image">, label: string) => (
    <Field label={label} htmlFor={`as-${k}`}>
      <Input id={`as-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} data-testid={`association-${k.replace(/_/g, "-")}-input`} />
    </Field>
  );
  return (
    <form
      className="max-w-3xl space-y-5 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <ImageUpload value={form.logo} onChange={(v) => set("logo", v)} label="Logo dell'associazione" testid="association-logo" />
      <p className="-mt-3 text-xs text-muted-foreground" data-testid="association-logo-icon-hint">
        Il logo viene usato anche come icona dell'app sul telefono e nella scheda del browser.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Nome associazione")}
        {text("email", "Email")}
        {text("address", "Sede / indirizzo")}
        {text("city", "CAP e comune")}
        {text("phone", "Telefono")}
        {text("website", "Sito web")}
        {text("vat_number", "Partita IVA")}
        {text("fiscal_code", "Codice fiscale")}
      </div>
      <Field label="Descrizione" htmlFor="as-description">
        <Textarea id="as-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} data-testid="association-description-input" />
      </Field>
      <Field label="Regolamento convenzione (mostrato ad atleti)" htmlFor="as-rules">
        <Textarea id="as-rules" rows={3} value={form.convention_rules} onChange={(e) => set("convention_rules", e.target.value)} data-testid="association-rules-input" />
      </Field>
      <fieldset className="space-y-4 rounded-xl border border-dashed p-4" data-testid="association-home-content">
        <legend className="px-1 text-sm font-semibold">Testi e immagini della home page</legend>
        <ImageUpload value={form.hero_image} onChange={(v) => set("hero_image", v)} label="Immagine in evidenza (se vuota si usa il logo)" testid="association-hero-image" crop="square" maxPx={1200} />
        <div className="grid gap-4 sm:grid-cols-2">
          {text("home_badge", "Etichetta sopra il titolo")}
          {text("home_title", "Titolo principale")}
        </div>
        <Field label="Testo di presentazione" htmlFor="as-home_subtitle">
          <Textarea id="as-home_subtitle" rows={3} value={form.home_subtitle} onChange={(e) => set("home_subtitle", e.target.value)} data-testid="association-home-subtitle-input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("step1_title", "Passo 1 · titolo")}
          {text("step1_text", "Passo 1 · testo")}
          {text("step2_title", "Passo 2 · titolo")}
          {text("step2_text", "Passo 2 · testo")}
          {text("step3_title", "Passo 3 · titolo")}
          {text("step3_text", "Passo 3 · testo")}
          {text("partners_title", "Titolo sezione partner")}
          {text("partners_subtitle", "Sottotitolo sezione partner")}
        </div>
      </fieldset>
      <Button type="submit" disabled={save.isPending} data-testid="association-save-button">
        {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva dati associazione
      </Button>
    </form>
  );
}

export default function Admin() {
  const assoc = useAssociation();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gold-ink">Portale direttivo</p>
        <h1 className="text-2xl font-semibold tracking-tight">Convenzione Sponsor · {assoc.data?.name ?? "Leinì Volley"}</h1>
      </div>
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="overview" data-testid="admin-tab-overview">Panoramica</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="admin-tab-transactions">Transazioni</TabsTrigger>
            <TabsTrigger value="athletes" data-testid="admin-tab-athletes"><Users className="size-4" /> Atleti</TabsTrigger>
            <TabsTrigger value="merchants" data-testid="admin-tab-merchants"><Store className="size-4" /> Commercianti</TabsTrigger>
            <TabsTrigger value="categories" data-testid="admin-tab-categories">Categorie</TabsTrigger>
            <TabsTrigger value="ranking" data-testid="admin-tab-ranking">Classifica sponsor</TabsTrigger>
            <TabsTrigger value="reports" data-testid="admin-tab-reports">Report mensili</TabsTrigger>
            <TabsTrigger value="association" data-testid="admin-tab-association">Associazione</TabsTrigger>
            <TabsTrigger value="bacheca" data-testid="admin-tab-bacheca">Notizie e foto</TabsTrigger>
            <TabsTrigger value="board" data-testid="admin-tab-board">Direttivo</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-6"><Overview /></TabsContent>
        <TabsContent value="transactions" className="mt-6"><TransactionsReport /></TabsContent>
        <TabsContent value="athletes" className="mt-6"><AthletesTab /></TabsContent>
        <TabsContent value="merchants" className="mt-6"><AdminMerchantsTabWrapper /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab /></TabsContent>
        <TabsContent value="ranking" className="mt-6"><RankingTab /></TabsContent>
        <TabsContent value="board" className="mt-6"><BoardTab /></TabsContent>
        <TabsContent value="bacheca" className="mt-6"><BachecaTab /></TabsContent>
        <TabsContent value="reports" className="mt-6 space-y-6"><EmailTestCard /><ReportsTab /></TabsContent>
        <TabsContent value="association" className="mt-6">
          {assoc.isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          ) : (
            <AssociationForm initial={assoc.data ?? EMPTY_ASSOC} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
