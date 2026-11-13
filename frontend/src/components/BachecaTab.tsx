import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Images, Loader2, Mail, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import { Field } from "@/components/ProfileFields";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { dateTime, errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { ClubNews, ClubNewsIn, EmailStatus, EmailTestResult, EventPhoto, EventPhotoIn } from "@/lib/types";

const NEWS_KEY = ["news"];
const PHOTOS_KEY = ["event-photos"];

function NewsManager() {
  const [form, setForm] = useState<ClubNewsIn>({ title: "", body: "" });
  const list = useQuery({ queryKey: NEWS_KEY, queryFn: () => apiGet<ClubNews[]>("/news") });
  const add = useMutation({
    mutationFn: (b: ClubNewsIn) => apiPost<ClubNews>("/admin/news", b),
    onSuccess: () => {
      toast.success("Notizia pubblicata per gli atleti");
      setForm({ title: "", body: "" });
      void queryClient.invalidateQueries({ queryKey: NEWS_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/news/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NEWS_KEY }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const items = list.isError ? [] : (list.data ?? []);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" data-testid="board-news">
      <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="size-4 text-primary" /> Notizie del club</h2>
      <p className="-mt-2 text-sm text-muted-foreground">Le vedono solo gli atleti, sulla pagina della tessera.</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(form);
        }}
      >
        <Field label="Titolo" htmlFor="news-title">
          <Input id="news-title" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="news-title-input" />
        </Field>
        <Field label="Testo" htmlFor="news-body">
          <Textarea id="news-body" required rows={3} maxLength={1000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="news-body-input" />
        </Field>
        <Button type="submit" disabled={add.isPending} data-testid="news-publish-button">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Pubblica notizia
        </Button>
      </form>
      <ul className="divide-y" data-testid="board-news-list">
        {items.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nessuna notizia pubblicata.</li>}
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-3 py-3" data-testid={`board-news-${n.id}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{n.title}</p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{dateTime(n.created_at)}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Elimina notizia" onClick={() => del.mutate(n.id)} data-testid={`board-news-delete-${n.id}`}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventPhotosManager() {
  const [form, setForm] = useState<{ image: string | null; caption: string }>({ image: null, caption: "" });
  const list = useQuery({ queryKey: [...PHOTOS_KEY, "admin"], queryFn: () => apiGet<EventPhoto[]>("/admin/event-photos") });
  const add = useMutation({
    mutationFn: (b: EventPhotoIn) => apiPost<EventPhoto>("/admin/event-photos", b),
    onSuccess: () => {
      toast.success("Foto aggiunta alla home");
      setForm({ image: null, caption: "" });
      void queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/event-photos/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PHOTOS_KEY }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const items = list.isError ? [] : (list.data ?? []);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" data-testid="board-event-photos">
      <h2 className="flex items-center gap-2 font-semibold"><Images className="size-4 text-primary" /> Galleria partite ed eventi</h2>
      <p className="-mt-2 text-sm text-muted-foreground">In home page compaiono le 12 foto più recenti.</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.image) {
            toast.error("Scegli una foto");
            return;
          }
          add.mutate({ image: form.image, caption: form.caption });
        }}
      >
        <ImageUpload value={form.image} onChange={(v) => setForm({ ...form, image: v })} label="Foto" testid="event-photo-upload" maxPx={1600} crop="landscape" />
        <Field label="Didascalia" htmlFor="event-caption">
          <Input id="event-caption" maxLength={140} placeholder="Es. Under 16 · vittoria 3-1 a Chivasso" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} data-testid="event-photo-caption-input" />
        </Field>
        <Button type="submit" disabled={add.isPending} data-testid="event-photo-add-button">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Aggiungi alla home
        </Button>
      </form>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="board-event-photos-list">
        {items.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nessuna foto caricata.</p>}
        {items.map((p, i) => (
          <figure key={p.id} className={`relative overflow-hidden rounded-lg border ${i >= 12 ? "opacity-50" : ""}`} data-testid={`board-event-photo-${p.id}`}>
            <img src={p.image} alt={p.caption || "Foto evento"} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="truncate px-2 py-1 text-xs">{p.caption || "—"}{i >= 12 && " · non in home"}</figcaption>
            <button
              type="button"
              aria-label="Elimina foto"
              onClick={() => del.mutate(p.id)}
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive"
              data-testid={`board-event-photo-delete-${p.id}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function EmailTestCard() {
  const [to, setTo] = useState("");
  const status = useQuery({ queryKey: ["email-status"], queryFn: () => apiGet<EmailStatus>("/admin/email/status") });
  const send = useMutation({
    mutationFn: () => apiPost<EmailTestResult>("/admin/email/test", { to }),
    onSuccess: (r) => toast.success(`Email di prova inviata tramite ${r.provider === "gmail" ? "Gmail" : "Emergent"}`),
    onError: (e) => toast.error(errMsg(e)),
  });
  const s = status.data;
  return (
    <section className="max-w-xl space-y-3 rounded-xl border bg-card p-5" data-testid="email-test-card">
      <h2 className="flex items-center gap-2 font-semibold"><Mail className="size-4 text-primary" /> Invio email</h2>
      <p className="text-sm text-muted-foreground" data-testid="email-provider-status">
        {s ? (s.provider === "gmail" ? `Le email partono dal tuo Gmail (${s.sender})` : "Le email partono dal servizio Emergent") : "…"}
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Input type="email" required placeholder="indirizzo@esempio.it" value={to} onChange={(e) => setTo(e.target.value)} data-testid="email-test-to-input" />
        <Button type="submit" disabled={send.isPending} data-testid="email-test-send-button">
          {send.isPending && <Loader2 className="size-4 animate-spin" />} Invia prova
        </Button>
      </form>
    </section>
  );
}

export default function BachecaTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <NewsManager />
      <EventPhotosManager />
    </div>
  );
}
