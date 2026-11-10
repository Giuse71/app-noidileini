import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Medal, Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { eur, initials } from "@/lib/format";
import type { Ranking, RankingRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const PODIUM = [
  { icon: Trophy, ring: "border-gold bg-gold-soft", text: "text-gold-ink", label: "1° posto", h: "md:pt-0" },
  { icon: Medal, ring: "border-slate-300 bg-slate-50", text: "text-slate-600", label: "2° posto", h: "md:pt-8" },
  { icon: Award, ring: "border-amber-700/40 bg-amber-50", text: "text-amber-800", label: "3° posto", h: "md:pt-12" },
];

function Logo({ r, size = "size-10" }: { r: RankingRow; size?: string }) {
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-white text-xs font-bold text-primary", size)}>
      {r.logo ? <img src={r.logo} alt="" className="size-full object-contain" /> : initials(...r.merchant_name.split(" "))}
    </div>
  );
}

export default function RankingTab() {
  const [season, setSeason] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["ranking", season],
    queryFn: () => apiGet<Ranking>(`/admin/rankings${season ? `?season=${season}` : ""}`),
  });
  const data = q.isError ? undefined : q.data;
  const cur = data?.current_start_year;
  const seasons = cur ? Array.from({ length: 5 }, (_, i) => cur - i) : [];
  const rows = data?.rows ?? [];
  const top = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Classifica sponsor</h2>
          <p className="text-sm text-muted-foreground">Partner ordinati per sconti concessi agli atleti nella stagione (1 settembre – 31 agosto)</p>
        </div>
        {cur && (
          <Select value={String(season ?? cur)} onValueChange={(v: string) => setSeason(Number(v))}>
            <SelectTrigger className="ml-auto w-44" data-testid="ranking-season-select">
              <SelectValue>{(v) => `Stagione ${v}/${Number(v) + 1}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {seasons.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Stagione {y}/{y + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground" data-testid="ranking-empty">
          {q.isLoading ? "Caricamento…" : "Nessuna vendita in convenzione in questa stagione"}
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 md:items-start" data-testid="ranking-podium">
            {top.map((r, i) => {
              const P = PODIUM[i];
              return (
                <div key={r.merchant_id} className={cn("animate-fade-up", P.h)} style={{ animationDelay: `${i * 90}ms` }}>
                  <div className={cn("rounded-2xl border-2 p-4", P.ring)} data-testid={`ranking-podium-${i + 1}`}>
                    <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wider", P.text)}>
                      <P.icon className="size-4" /> {P.label}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Logo r={r} size="size-12" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.merchant_name}</p>
                        <p className="text-xs text-muted-foreground">{r.sector || "—"}</p>
                      </div>
                    </div>
                    <p className="tnum mt-3 text-2xl font-bold text-navy">{eur(r.discount)}</p>
                    <p className="text-xs text-muted-foreground">
                      di sconti · {r.count} vendite · {r.athletes} tesserati
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/70">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Vendite</TableHead>
                  <TableHead className="text-right">Tesserati</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Sconti concessi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.merchant_id} data-testid={`ranking-row-${r.rank}`}>
                    <TableCell className="tnum font-semibold">{r.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Logo r={r} size="size-8" />
                        <span className="font-medium">{r.merchant_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tnum text-right">{r.count}</TableCell>
                    <TableCell className="tnum text-right">{r.athletes}</TableCell>
                    <TableCell className="tnum text-right">{eur(r.amount)}</TableCell>
                    <TableCell className="tnum text-right font-semibold">{eur(r.discount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="tnum text-right text-sm text-muted-foreground" data-testid="ranking-total">
            Totale sconti stagione {data?.label}: <strong className="text-foreground">{eur(data?.total_discount ?? 0)}</strong>
          </p>
        </>
      )}
    </div>
  );
}
