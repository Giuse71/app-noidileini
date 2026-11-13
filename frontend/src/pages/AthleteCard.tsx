import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, CloudOff, Hand, Megaphone, Maximize2, PiggyBank, Receipt, RefreshCw, Sparkles, Users } from "lucide-react";
import InstallCard from "@/components/InstallCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Crest from "@/components/Crest";
import MerchantList from "@/components/MerchantList";
import StatCard from "@/components/StatCard";
import { apiGet } from "@/lib/api";
import { dateTime, eur, initials, pct, totals } from "@/lib/format";
import { syncLabel, useLastSync, useOnline } from "@/lib/offline";
import { useAssociation, useMe, useMerchants } from "@/lib/session";
import type { ClubNews, FamilyMember, Transaction } from "@/lib/types";

interface QrTarget {
  name: string;
  sub: string;
  code: string;
}

export default function AthleteCard() {
  const { data: me, dataUpdatedAt } = useMe();
  const { data: assoc } = useAssociation();
  const tx = useQuery({ queryKey: ["transactions", "mine"], queryFn: () => apiGet<Transaction[]>("/transactions/mine") });
  // same key as the family page, so the service worker keeps family QR codes for offline use
  const family = useQuery({ queryKey: ["family"], queryFn: () => apiGet<FamilyMember[]>("/athletes/me/family") });
  const news = useQuery({ queryKey: ["news"], queryFn: () => apiGet<ClubNews[]>("/news") });
  const online = useOnline();
  const lastSync = useLastSync(dataUpdatedAt, online);
  const [big, setBig] = useState<QrTarget | null>(null);
  const merchants = useMerchants();
  const promos = (merchants.isError ? [] : (merchants.data ?? [])).filter((m) => m.promo_active);
  const a = me?.athlete;
  if (!a) return null;
  const t = totals(tx.isError ? [] : (tx.data ?? []));
  const relatives = family.isError ? [] : (family.data ?? []);
  const self: QrTarget = { name: `${a.first_name} ${a.last_name}`, sub: a.category_name || "Atleta", code: a.code };

  return (
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <section className="space-y-4">
        <div className="relative animate-fade-up overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-navy p-5 text-white shadow-xl" data-testid="athlete-card">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-white/10" />
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border-[18px] border-gold/30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crest logo={assoc?.logo} className="size-9" />
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-200">Tessera digitale</p>
                <p className="text-sm font-semibold">{assoc?.name ?? "Leinì Volley"}</p>
              </div>
            </div>
            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-navy" data-testid="athlete-card-category">
              {a.category_name || "Senza categoria"}
              {a.team_role && ` · ${a.team_role}`}
            </span>
          </div>
          <div className="relative mt-6 flex items-end gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold bg-white/10 text-2xl font-bold">
              {a.photo ? <img src={a.photo} alt="Foto atleta" className="size-full object-cover" /> : initials(a.first_name, a.last_name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold" data-testid="athlete-card-name">
                {a.first_name} {a.last_name}
              </p>
              <p className="tnum font-mono text-sm tracking-widest text-blue-100" data-testid="athlete-card-code">
                {a.code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBig(self)}
            className="relative mt-6 flex w-full items-center gap-4 rounded-xl bg-white p-3 text-left text-navy transition-transform duration-200 hover:scale-[1.01]"
            data-testid="athlete-qr-open-button"
          >
            <QRCodeSVG value={a.code} size={96} fgColor="#1e3a8a" />
            <div>
              <p className="font-semibold">Mostra al commerciante</p>
              <p className="text-xs text-slate-500">Tocca per ingrandire il QR</p>
            </div>
            <Maximize2 className="ml-auto size-5 text-primary" />
          </button>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${online ? "bg-accent text-primary" : "bg-gold-soft text-gold-ink"}`}
          role="status"
          data-testid="athlete-card-sync-badge"
        >
          {online ? <RefreshCw className="size-3.5" /> : <CloudOff className="size-3.5" />}
          {online ? `Tessera aggiornata · ${syncLabel(lastSync)}` : `Offline · tessera aggiornata il ${syncLabel(lastSync)}`}
        </div>
        {relatives.length > 0 && (
          <div className="rounded-xl border bg-card p-3" data-testid="athlete-card-family-qr">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">QR familiari · funzionano anche offline</p>
            <ul className="mt-2 divide-y">
              {relatives.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setBig({ name: `${f.first_name} ${f.last_name}`, sub: f.relation || "Familiare", code: f.code })}
                    className="flex w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:text-primary"
                    data-testid={`athlete-card-family-qr-${f.id}`}
                  >
                    <QRCodeSVG value={f.code} size={36} fgColor="#1e3a8a" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{f.first_name} {f.last_name}</span>
                      <span className="block font-mono text-[11px] tracking-widest text-muted-foreground">{f.code}</span>
                    </span>
                    <Maximize2 className="size-4 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <InstallCard />
        <Link
          to="/atleta/famiglia"
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
          data-testid="athlete-family-link"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-ink">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Tessere familiari</p>
            <p className="text-xs text-muted-foreground">Estendi lo sconto a genitori e parenti</p>
          </div>
          <ArrowRight className="size-4 text-primary" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Risparmio totale" value={eur(t.discount)} icon={PiggyBank} accent testid="athlete-total-savings" />
          <StatCard label="Acquisti in convenzione" value={String(t.count)} icon={Receipt} testid="athlete-total-count" />
        </div>
      </section>

      <section className="space-y-6">
        {(news.data?.length ?? 0) > 0 && !news.isError && (
          <div className="animate-fade-up rounded-2xl border bg-card p-4" data-testid="athlete-news">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <Megaphone className="size-4" /> Notizie dal club
            </p>
            <ul className="mt-3 space-y-3">
              {news.data?.slice(0, 5).map((n) => (
                <li key={n.id} className="border-l-2 border-gold pl-3" data-testid={`athlete-news-${n.id}`}>
                  <p className="font-semibold">{n.title}</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{dateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {promos.length > 0 && (
          <div className="animate-fade-up rounded-2xl border border-gold/50 bg-gold-soft p-4" data-testid="athlete-promos">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold-ink">
              <Sparkles className="size-4" /> Promozioni del mese
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {promos.map((m) => (
                <div key={m.id} className="rounded-xl bg-white p-3 shadow-sm" data-testid={`athlete-promo-${m.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{m.business_name}</p>
                    <span className="tnum shrink-0 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-navy">-{pct(m.discount_percent)}</span>
                  </div>
                  <p className="mt-1 font-semibold">{m.promo_title}</p>
                  {m.promo_description && <p className="mt-0.5 text-sm text-muted-foreground">{m.promo_description}</p>}
                  {m.promo_end && <p className="mt-1 text-[11px] text-gold-ink">Fino al {m.promo_end.split("-").reverse().join("/")}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dove risparmiare oggi</h1>
            <p className="text-sm text-muted-foreground">Partner della convenzione sponsor</p>
          </div>
          <Link to="/atleta/convenzioni" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="athlete-all-merchants-link">
            Tutte <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent/60 px-3 py-2 text-xs text-primary" data-testid="athlete-merchants-hint">
          <Hand className="mt-px size-3.5 shrink-0" />
          Scorri la lista dei partner e tocca un'offerta per vedere i dettagli dello sconto e le informazioni del commerciante
        </p>
        <div className="mt-3">
          <MerchantList limit={4} />
        </div>
        </div>
      </section>

      <Dialog open={big !== null} onOpenChange={(o) => !o && setBig(null)}>
        <DialogContent className="sm:max-w-sm" data-testid="athlete-qr-dialog">
          <DialogHeader>
            <DialogTitle data-testid="athlete-qr-dialog-name">{big?.name}</DialogTitle>
            <DialogDescription>{big?.sub}</DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center gap-3 py-2">
            <QRCodeSVG value={big?.code ?? ""} size={260} fgColor="#1e3a8a" data-testid="athlete-qr-large" />
            <p className="tnum font-mono text-lg font-semibold tracking-[0.3em]" data-testid="athlete-qr-dialog-code">{big?.code}</p>
          </div>
          <Button variant="outline" onClick={() => setBig(null)} data-testid="athlete-qr-close-button">
            Chiudi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
