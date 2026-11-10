import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Keyboard, List, Loader2, QrCode, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/ProfileFields";
import QrScanner from "@/components/QrScanner";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, eur, initials, parseAmount, pct } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { useMe } from "@/lib/session";
import type { Athlete, Transaction, TransactionCreate } from "@/lib/types";

function AthleteAvatar({ a, size = "size-12" }: { a: Athlete; size?: string }) {
  return (
    <div className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-semibold text-primary`}>
      {a.photo ? <img src={a.photo} alt="" className="size-full object-cover" /> : initials(a.first_name, a.last_name)}
    </div>
  );
}

function AthletePicker({ onPick }: { onPick: (a: Athlete) => void }) {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["athletes", q],
    queryFn: () => apiGet<Athlete[]>(`/athletes?q=${encodeURIComponent(q)}`),
  });
  const rows = list.isError ? [] : (list.data ?? []);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, cognome o codice" className="pl-9" data-testid="athlete-search-input" />
      </div>
      <div className="max-h-80 divide-y overflow-y-auto rounded-xl border" data-testid="athlete-list">
        {rows.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{list.isLoading ? "Caricamento…" : "Nessun atleta trovato"}</p>}
        {rows.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            data-testid={`athlete-pick-${a.code}`}
          >
            <AthleteAvatar a={a} size="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {a.first_name} {a.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{a.category_name || "—"}</p>
            </div>
            <span className="tnum font-mono text-xs text-muted-foreground">{a.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MerchantCassa() {
  const { data: me } = useMe();
  const merchant = me?.merchant;
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [code, setCode] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [note, setNote] = useState("");
  const [last, setLast] = useState<Transaction | null>(null);

  const lookup = useMutation({
    mutationFn: (c: string) => apiGet<Athlete>(`/athletes/by-code/${encodeURIComponent(c.trim().toUpperCase())}`),
    onSuccess: (a) => {
      setAthlete(a);
      setLast(null);
      toast.success(`Atleta riconosciuto: ${a.first_name} ${a.last_name}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const register = useMutation({
    mutationFn: (b: TransactionCreate) => apiPost<Transaction>("/transactions", b),
    onSuccess: (t) => {
      setLast(t);
      setAthlete(null);
      setAmountRaw("");
      setNote("");
      setCode("");
      toast.success("Transazione registrata");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const discountPct = merchant?.discount_percent ?? 0;
  const amount = parseAmount(amountRaw);
  const discount = Math.round(amount * discountPct) / 100;
  const net = Math.max(0, amount - discount);

  function pick(a: Athlete) {
    setAthlete(a);
    setLast(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cassa convenzione</h1>
          <p className="text-sm text-muted-foreground">1. Identifica l'atleta · 2. Inserisci l'importo · 3. Registra</p>
        </div>
        <Tabs defaultValue="scan">
          <TabsList className="w-full">
            <TabsTrigger value="scan" data-testid="cassa-tab-scan">
              <QrCode className="size-4" /> Scansiona
            </TabsTrigger>
            <TabsTrigger value="code" data-testid="cassa-tab-code">
              <Keyboard className="size-4" /> Codice
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="cassa-tab-list">
              <List className="size-4" /> Elenco atleti
            </TabsTrigger>
          </TabsList>
          <TabsContent value="scan" className="mt-4">
            <QrScanner onResult={(text) => lookup.mutate(text)} />
          </TabsContent>
          <TabsContent value="code" className="mt-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) lookup.mutate(code);
              }}
            >
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Es. LV-GR1606" className="h-10 font-mono uppercase" data-testid="manual-code-input" />
              <Button type="submit" className="h-10" disabled={lookup.isPending} data-testid="manual-code-submit">
                {lookup.isPending ? <Loader2 className="size-4 animate-spin" /> : "Cerca"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <AthletePicker onPick={pick} />
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-4">
        {last && (
          <div className="animate-fade-up rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="last-transaction-receipt">
            <div className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="size-5" /> Transazione registrata
            </div>
            <p className="mt-1 text-sm text-emerald-900">
              {last.athlete_name} · {eur(last.amount)} − {eur(last.discount_amount)} = <strong data-testid="last-transaction-final">{eur(last.final_amount)}</strong>
            </p>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-5" data-testid="discount-calculator">
          {athlete ? (
            <div className="flex items-center gap-3 rounded-xl bg-accent p-3" data-testid="selected-athlete">
              <AthleteAvatar a={athlete} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" data-testid="selected-athlete-name">
                  {athlete.first_name} {athlete.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {athlete.category_name || "—"} · <span className="font-mono">{athlete.code}</span>
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setAthlete(null)} data-testid="selected-athlete-clear">
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="no-athlete-selected">
              Nessun atleta selezionato
            </div>
          )}

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!athlete) return toast.error("Seleziona prima un atleta");
              if (amount <= 0) return toast.error("Inserisci un importo valido");
              register.mutate({ athlete_id: athlete.id, amount, note });
            }}
          >
            <Field label="Importo speso (€)" htmlFor="amount">
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                className="tnum h-14 text-2xl font-semibold"
                data-testid="amount-input"
              />
            </Field>
            <Field label="Nota (facoltativa)" htmlFor="note">
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. scontrino n. 123" data-testid="note-input" />
            </Field>
            <dl className="space-y-2 rounded-xl bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Importo lordo</dt>
                <dd className="tnum" data-testid="calc-gross">{eur(amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Sconto convenzione <span className="ml-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy">-{pct(discountPct)}</span>
                </dt>
                <dd className="tnum text-gold-ink" data-testid="calc-discount">-{eur(discount)}</dd>
              </div>
              <div className="flex items-end justify-between border-t pt-3">
                <dt className="font-medium">Totale da pagare</dt>
                <dd className="tnum text-3xl font-bold text-navy" data-testid="calc-net">{eur(net)}</dd>
              </div>
            </dl>
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={register.isPending || !athlete || amount <= 0} data-testid="register-transaction-button">
              {register.isPending && <Loader2 className="size-4 animate-spin" />} Conferma e registra transazione
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
