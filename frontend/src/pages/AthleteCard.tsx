import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Maximize2, PiggyBank, Receipt } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Crest from "@/components/Crest";
import MerchantList from "@/components/MerchantList";
import StatCard from "@/components/StatCard";
import { apiGet } from "@/lib/api";
import { eur, initials, totals } from "@/lib/format";
import { useAssociation, useMe } from "@/lib/session";
import type { Transaction } from "@/lib/types";

export default function AthleteCard() {
  const { data: me } = useMe();
  const { data: assoc } = useAssociation();
  const tx = useQuery({ queryKey: ["transactions", "mine"], queryFn: () => apiGet<Transaction[]>("/transactions/mine") });
  const [big, setBig] = useState(false);
  const a = me?.athlete;
  if (!a) return null;
  const t = totals(tx.isError ? [] : (tx.data ?? []));

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
            onClick={() => setBig(true)}
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
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Risparmio totale" value={eur(t.discount)} icon={PiggyBank} accent testid="athlete-total-savings" />
          <StatCard label="Acquisti in convenzione" value={String(t.count)} icon={Receipt} testid="athlete-total-count" />
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dove risparmiare oggi</h1>
            <p className="text-sm text-muted-foreground">Partner della convenzione sponsor</p>
          </div>
          <Link to="/atleta/convenzioni" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="athlete-all-merchants-link">
            Tutte <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4">
          <MerchantList limit={4} />
        </div>
      </section>

      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="sm:max-w-sm" data-testid="athlete-qr-dialog">
          <DialogHeader>
            <DialogTitle>
              {a.first_name} {a.last_name}
            </DialogTitle>
            <DialogDescription>{a.category_name}</DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center gap-3 py-2">
            <QRCodeSVG value={a.code} size={260} fgColor="#1e3a8a" data-testid="athlete-qr-large" />
            <p className="tnum font-mono text-lg font-semibold tracking-[0.3em]">{a.code}</p>
          </div>
          <Button variant="outline" onClick={() => setBig(false)} data-testid="athlete-qr-close-button">
            Chiudi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
