import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Mail, Pencil, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, MerchantFields } from "@/components/ProfileFields";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { dateTime, EMPTY_MERCHANT, errMsg, eur, initials, pct } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useAssociation } from "@/lib/session";
import type { AdminMerchant, AdminMerchantSave, DigestResult, InviteResult, MonthlyReport, ReportLog, SendReportResult, Transaction } from "@/lib/types";

const ADMIN_MERCHANTS = ["admin-merchants"];

function MerchantEditor({ target, onClose }: { target: AdminMerchant | "new"; onClose: () => void }) {
  const isNew = target === "new";
  const [form, setForm] = useState<AdminMerchantSave>(() => {
    if (isNew) return { ...EMPTY_MERCHANT, account_email: "", new_password: "", published: true };
    const { id: _i, created_at: _c, promo_active: _p, rating_avg: _ra, rating_count: _rc, invited_at: _inv, announced_at: _an, ...rest } = target;
    return { ...rest, new_password: "" };
  });
  const save = useMutation({
    mutationFn: (b: AdminMerchantSave) => {
      const body = { ...b, new_password: b.new_password ? b.new_password : null };
      return isNew ? apiPost<AdminMerchant>("/admin/merchants", body) : apiPut<AdminMerchant>(`/admin/merchants/${target.id}`, body);
    },
    onSuccess: () => {
      toast.success(isNew ? "Commerciante creato" : "Commerciante aggiornato");
      void queryClient.invalidateQueries({ queryKey: ADMIN_MERCHANTS });
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <MerchantFields value={form} onChange={(v) => setForm({ ...form, ...v })} />
      <div className="space-y-4 rounded-xl border bg-muted/50 p-4">
        <p className="text-sm font-semibold">Accesso del commerciante</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email di accesso" htmlFor="am-email" hint="Il commerciante entra con questa email e può modificare i suoi dati">
            <Input id="am-email" type="email" required value={form.account_email} onChange={(e) => setForm({ ...form, account_email: e.target.value })} data-testid="admin-merchant-account-email-input" />
          </Field>
          <Field label="Password (facoltativa)" htmlFor="am-pw" hint={isNew ? "Lascia vuoto: il commerciante la sceglierà dal link dell'invito" : "Lascia vuoto per non cambiarla"}>
            <Input id="am-pw" type="text" minLength={6} value={form.new_password ?? ""} onChange={(e) => setForm({ ...form, new_password: e.target.value })} data-testid="admin-merchant-password-input" />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">La prima volta che lo rendi visibile, gli atleti iscritti agli avvisi ricevono un'email sul nuovo partner.</p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v === true })} data-testid="admin-merchant-published-checkbox" />
          Visibile ad atleti e nella pagina pubblica delle convenzioni
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} data-testid="admin-merchant-cancel">
          Annulla
        </Button>
        <Button type="submit" disabled={save.isPending} data-testid="admin-merchant-save-button">
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva
        </Button>
      </div>
    </form>
  );
}

export function AdminMerchantsTab({ transactions }: { transactions: Transaction[] }) {
  const list = useQuery({ queryKey: ADMIN_MERCHANTS, queryFn: () => apiGet<AdminMerchant[]>("/admin/merchants") });
  const merchants = list.isError ? [] : (list.data ?? []);
  const [editing, setEditing] = useState<AdminMerchant | "new" | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of transactions) m.set(r.merchant_id, (m.get(r.merchant_id) ?? 0) + 1);
    return m;
  }, [transactions]);
  const published = merchants.filter((m) => m.published).length;
  const invite = useMutation({
    mutationFn: (id: string) => apiPost<InviteResult>(`/admin/merchants/${id}/invite`),
    onSuccess: (r) => {
      toast.success(`Invito inviato a ${r.sent_to}`);
      void queryClient.invalidateQueries({ queryKey: ADMIN_MERCHANTS });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" data-testid="admin-merchants-summary">
          {merchants.length} commercianti · {published} visibili · {merchants.length - published} da completare · puoi aggiungerne quanti vuoi
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setEditing("new")} data-testid="admin-merchant-add-button">
          <Plus className="size-4" /> Aggiungi commerciante
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70">
              <TableHead>Attività</TableHead>
              <TableHead>P.IVA</TableHead>
              <TableHead>Accesso</TableHead>
              <TableHead className="text-right">Sconto</TableHead>
              <TableHead className="text-right">Transazioni</TableHead>
              <TableHead className="text-right">Stato</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.map((m) => (
              <TableRow key={m.id} data-testid={`admin-merchant-row-${m.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-accent text-xs font-bold text-primary">
                      {m.logo ? <img src={m.logo} alt="" className="size-full bg-white object-contain" /> : initials(...m.business_name.split(" "))}
                    </div>
                    <div>
                      <p className="font-medium">{m.business_name}</p>
                      <p className="text-xs text-muted-foreground">{[m.legal_name, m.sector].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tnum font-mono text-xs">{m.vat_number}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <p>{m.account_email}</p>
                  <p className="mt-0.5 text-[11px]" data-testid={`admin-merchant-invite-status-${m.id}`}>
                    {m.invited_at ? `Invitato il ${dateTime(m.invited_at)}` : "Invito non inviato"}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">-{pct(m.discount_percent)}</span>
                </TableCell>
                <TableCell className="tnum text-right">{counts.get(m.id) ?? 0}</TableCell>
                <TableCell className="text-right">
                  {m.published ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      <Eye className="size-3" /> Visibile
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <EyeOff className="size-3" /> Nascosto
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={invite.isPending}
                    onClick={() => {
                      if (window.confirm(`Inviare a ${m.account_email} l'email di benvenuto con il link per scegliere la password?`)) invite.mutate(m.id);
                    }}
                    data-testid={`admin-merchant-invite-${m.id}`}
                  >
                    {invite.isPending && invite.variables === m.id ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    {m.invited_at ? "Reinvia invito" : "Invia invito"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(m)} data-testid={`admin-merchant-edit-${m.id}`}>
                    <Pencil className="size-4" /> Modifica
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="admin-merchant-dialog">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nuovo commerciante" : "Modifica commerciante"}</DialogTitle>
            <DialogDescription>Logo, dati aziendali, sconto e credenziali di accesso</DialogDescription>
          </DialogHeader>
          {editing !== null && <MerchantEditor key={editing === "new" ? "new" : editing.id} target={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function lastMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ value: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[x.getMonth()]} ${x.getFullYear()}` });
  }
  return out;
}

const STATUS: Record<ReportLog["status"], string> = {
  sent: "bg-emerald-50 text-emerald-800",
  skipped: "bg-muted text-muted-foreground",
  failed: "bg-red-50 text-red-800",
};
const STATUS_LABEL: Record<ReportLog["status"], string> = { sent: "Inviato", skipped: "Saltato", failed: "Errore" };

export function ReportsTab() {
  const months = useMemo(() => lastMonths(12), []);
  const [month, setMonth] = useState(months[1].value);
  const { data: assoc } = useAssociation();
  const report = useQuery({ queryKey: ["report", month], queryFn: () => apiGet<MonthlyReport>(`/admin/reports/monthly?month=${month}`) });
  const logs = useQuery({ queryKey: ["report-logs"], queryFn: () => apiGet<ReportLog[]>("/admin/reports/logs") });
  const send = useMutation({
    mutationFn: () => apiPost<SendReportResult>(`/admin/reports/monthly/send?month=${month}`),
    onSuccess: (r) => {
      toast.success(`Report: ${r.sent} inviati, ${r.skipped} saltati, ${r.failed} errori`);
      void queryClient.invalidateQueries({ queryKey: ["report-logs"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = report.isError ? [] : (report.data?.rows ?? []);
  const labels = Object.fromEntries(months.map((m) => [m.value, m.label]));
  const digest = useMutation({
    mutationFn: () => apiPost<DigestResult>("/admin/promo-digest/send"),
    onSuccess: (r) =>
      r.promos === 0 ? toast.info("Nessuna promozione attiva: riepilogo non inviato") : toast.success(`${r.promos} promozioni inviate a ${r.sent} atleti`),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-accent p-4 text-sm text-accent-foreground">
        <p className="flex items-center gap-2 font-semibold">
          <Mail className="size-4" /> Invio automatico il 1° di ogni mese alle 8:00
        </p>
        <p className="mt-1">
          Ogni commerciante con almeno una vendita riceve il riepilogo del mese precedente all'email di accesso, in copia a{" "}
          <strong data-testid="report-cc-email">{assoc?.email || "— (imposta l'email nella scheda Associazione)"}</strong>.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-gold-soft p-4 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gold-ink">Riepilogo promozioni per gli atleti · il 1° del mese alle 9:00</p>
          <p className="text-muted-foreground">Parte solo se ci sono promozioni attive; esclusi gli atleti che hanno disattivato gli avvisi.</p>
        </div>
        <Button
          variant="outline"
          disabled={digest.isPending}
          onClick={() => {
            if (window.confirm("Inviare ora il riepilogo delle promozioni attive agli atleti?")) digest.mutate();
          }}
          data-testid="digest-send-button"
        >
          {digest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Invia riepilogo ora
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={(v: string) => setMonth(v)}>
          <SelectTrigger className="w-52" data-testid="report-month-select">
            <SelectValue>{(v) => labels[v as string]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          disabled={send.isPending || rows.length === 0}
          onClick={() => {
            if (window.confirm(`Inviare ora i report di ${labels[month]} a ${rows.length} commercianti?`)) send.mutate();
          }}
          data-testid="report-send-button"
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Invia report ora
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70">
              <TableHead>Commerciante</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead className="text-right">Transazioni</TableHead>
              <TableHead className="text-right">Atleti</TableHead>
              <TableHead className="text-right">Lordo</TableHead>
              <TableHead className="text-right">Sconti</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground" data-testid="report-empty">
                  Nessuna vendita in convenzione in questo mese
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.merchant_id} data-testid={`report-row-${r.merchant_id}`}>
                <TableCell className="font-medium">{r.merchant_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.email}</TableCell>
                <TableCell className="tnum text-right">{r.count}</TableCell>
                <TableCell className="tnum text-right">{r.athletes}</TableCell>
                <TableCell className="tnum text-right">{eur(r.amount)}</TableCell>
                <TableCell className="tnum text-right">{eur(r.discount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold">Storico invii</h2>
        <div className="divide-y rounded-xl border bg-card" data-testid="report-logs">
          {(logs.data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">Nessun invio registrato</p>}
          {(logs.data ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[l.status]}`}>{STATUS_LABEL[l.status]}</span>
              <span className="font-medium">{l.merchant_name}</span>
              <span className="text-muted-foreground">{l.month}</span>
              <span className="text-xs text-muted-foreground">{l.recipients.join(", ") || l.detail}</span>
              <span className="tnum ml-auto text-xs text-muted-foreground">{dateTime(l.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
