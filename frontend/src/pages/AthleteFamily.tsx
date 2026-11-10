import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Maximize2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ProfileFields";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import ImageUpload from "@/components/ImageUpload";
import { errMsg, initials } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useMe } from "@/lib/session";
import type { FamilyMember, FamilyMemberIn } from "@/lib/types";

const FAMILY_KEY = ["family"];
const EMPTY: FamilyMemberIn = { first_name: "", last_name: "", relation: "", photo: null };

function FamilyEditor({ member, onDone }: { member: FamilyMember; onDone: () => void }) {
  const [form, setForm] = useState<FamilyMemberIn>({
    first_name: member.first_name,
    last_name: member.last_name,
    relation: member.relation,
    photo: member.photo,
  });
  const save = useMutation({
    mutationFn: (b: FamilyMemberIn) => apiPut<FamilyMember>(`/athletes/me/family/${member.id}`, b),
    onSuccess: () => {
      toast.success("Familiare aggiornato");
      void queryClient.invalidateQueries({ queryKey: FAMILY_KEY });
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <ImageUpload value={form.photo} onChange={(v) => setForm({ ...form, photo: v })} label="Foto (aiuta il commerciante a riconoscerlo)" testid="family-edit-photo" round placeholder={initials(form.first_name, form.last_name)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="fe-first">
          <Input id="fe-first" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="family-edit-first-name-input" />
        </Field>
        <Field label="Cognome" htmlFor="fe-last">
          <Input id="fe-last" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="family-edit-last-name-input" />
        </Field>
      </div>
      <Field label="Parentela" htmlFor="fe-rel">
        <Input id="fe-rel" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} data-testid="family-edit-relation-input" />
      </Field>
      <Button type="submit" className="w-full" disabled={save.isPending} data-testid="family-edit-save-button">
        {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva
      </Button>
    </form>
  );
}

export default function AthleteFamily() {
  const { data: me } = useMe();
  const list = useQuery({ queryKey: FAMILY_KEY, queryFn: () => apiGet<FamilyMember[]>("/athletes/me/family") });
  const rows = list.isError ? [] : (list.data ?? []);
  const [form, setForm] = useState<FamilyMemberIn>({ ...EMPTY, last_name: me?.athlete?.last_name ?? "" });
  const [open, setOpen] = useState<FamilyMember | null>(null);
  const [editing, setEditing] = useState<FamilyMember | null>(null);

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
        <div className="sm:col-span-4">
          <ImageUpload value={form.photo} onChange={(v) => setForm({ ...form, photo: v })} label="Foto del familiare (facoltativa)" testid="family-photo" round placeholder={initials(form.first_name, form.last_name) || undefined} />
        </div>
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
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold bg-accent text-sm font-semibold text-primary" data-testid={`family-avatar-${f.code}`}>
                  {f.photo ? <img src={f.photo} alt={f.first_name} className="size-full object-cover" /> : initials(f.first_name, f.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {f.first_name} {f.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.relation || "Familiare"} di {me?.athlete?.first_name}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(f)} data-testid={`family-edit-${f.code}`}>
                  <Pencil className="size-4" />
                </Button>
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

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md" data-testid="family-edit-dialog">
          <DialogHeader>
            <DialogTitle>Modifica familiare</DialogTitle>
            <DialogDescription>La foto compare al commerciante quando scansiona la tessera</DialogDescription>
          </DialogHeader>
          {editing && <FamilyEditor key={editing.id} member={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

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
