import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Maximize2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ProfileFields";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useMe } from "@/lib/session";
import type { FamilyMember, FamilyMemberIn } from "@/lib/types";

const FAMILY_KEY = ["family"];
const EMPTY: FamilyMemberIn = { first_name: "", last_name: "", relation: "" };

export default function AthleteFamily() {
  const { data: me } = useMe();
  const list = useQuery({ queryKey: FAMILY_KEY, queryFn: () => apiGet<FamilyMember[]>("/athletes/me/family") });
  const rows = list.isError ? [] : (list.data ?? []);
  const [form, setForm] = useState<FamilyMemberIn>({ ...EMPTY, last_name: me?.athlete?.last_name ?? "" });
  const [open, setOpen] = useState<FamilyMember | null>(null);

  const add = useMutation({
    mutationFn: (b: FamilyMemberIn) => apiPost<FamilyMember>("/athletes/me/family", b),
    onSuccess: (fm) => {
      toast.success(`Tessera creata per ${fm.first_name}`);
      setForm({ ...EMPTY, last_name: me?.athlete?.last_name ?? "" });
      void queryClient.invalidateQueries({ queryKey: FAMILY_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/athletes/me/family/${id}`),
    onSuccess: () => {
      toast.success("Familiare rimosso");
      void queryClient.invalidateQueries({ queryKey: FAMILY_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Familiari collegati</h1>
        <p className="text-sm text-muted-foreground">
          Ogni familiare riceve la propria tessera QR con lo sconto della convenzione. Mostrala dal tuo telefono o fai uno screenshot da condividere.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(form);
        }}
      >
        <Field label="Nome" htmlFor="fam-first">
          <Input id="fam-first" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="family-first-name-input" />
        </Field>
        <Field label="Cognome" htmlFor="fam-last">
          <Input id="fam-last" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="family-last-name-input" />
        </Field>
        <Field label="Parentela" htmlFor="fam-rel">
          <Input id="fam-rel" placeholder="Es. Mamma, Papà, Fratello" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} data-testid="family-relation-input" />
        </Field>
        <Button type="submit" disabled={add.isPending} data-testid="family-add-button">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Aggiungi
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground" data-testid="family-empty">
          <Users className="mb-2 size-6 text-primary" />
          Nessun familiare collegato: aggiungi genitori, fratelli o parenti.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="family-list">
          {rows.map((f) => (
            <div key={f.id} className="animate-fade-up rounded-2xl border bg-gradient-to-br from-white to-accent p-4" data-testid={`family-card-${f.code}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {f.first_name} {f.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.relation || "Familiare"} di {me?.athlete?.first_name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (window.confirm(`Rimuovere ${f.first_name} ${f.last_name}? La sua tessera non sarà più valida.`)) del.mutate(f.id);
                  }}
                  data-testid={`family-delete-${f.code}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(f)}
                className="mt-3 flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left transition-transform duration-200 hover:scale-[1.01]"
                data-testid={`family-qr-open-${f.code}`}
              >
                <QRCodeSVG value={f.code} size={72} fgColor="#1e3a8a" />
                <div>
                  <p className="tnum font-mono text-sm font-semibold tracking-widest">{f.code}</p>
                  <p className="text-xs text-muted-foreground">Tocca per ingrandire</p>
                </div>
                <Maximize2 className="ml-auto size-4 text-primary" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-sm" data-testid="family-qr-dialog">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {open.first_name} {open.last_name}
                </DialogTitle>
                <DialogDescription>
                  {open.relation || "Familiare"} di {me?.athlete?.first_name} {me?.athlete?.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid place-items-center gap-3 py-2">
                <QRCodeSVG value={open.code} size={260} fgColor="#1e3a8a" />
                <p className="tnum font-mono text-lg font-semibold tracking-[0.3em]">{open.code}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
