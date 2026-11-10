import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, eur, pct } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import Stars from "@/components/Stars";

const RATE_WINDOW_MS = 30 * 86_400_000;

export default function TransactionsTable({
  rows,
  showAthlete = true,
  showMerchant = true,
  emptyText = "Nessuna transazione registrata",
  testid = "transactions-table",
  showRating = false,
  onRate,
}: {
  showRating?: boolean;
  onRate?: (t: Transaction, stars: number) => void;
  rows: Transaction[];
  showAthlete?: boolean;
  showMerchant?: boolean;
  emptyText?: string;
  testid?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground" data-testid={`${testid}-empty`}>
        {emptyText}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card" data-testid={testid}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/70">
            <TableHead>Data/Ora</TableHead>
            {showAthlete && <TableHead>Atleta</TableHead>}
            {showMerchant && <TableHead>Commerciante</TableHead>}
            <TableHead className="text-right">Lordo</TableHead>
            <TableHead className="text-right">Sconto</TableHead>
            <TableHead className="text-right">Pagato</TableHead>
            {showRating && <TableHead className="text-center">{onRate ? "La tua valutazione" : "Valutazione"}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id} className="h-[46px]" data-testid={`transaction-row-${t.id}`}>
              <TableCell className="tnum whitespace-nowrap text-muted-foreground">{dateTime(t.created_at)}</TableCell>
              {showAthlete && (
                <TableCell>
                  {t.family_member_name ? (
                    <>
                      <p className="font-medium">{t.family_member_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.relation || "Familiare"} di {t.athlete_name} · {t.athlete_code}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{t.athlete_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.athlete_code}
                        {t.category_name && ` · ${t.category_name}`}
                      </p>
                    </>
                  )}
                </TableCell>
              )}
              {showMerchant && <TableCell className="font-medium">{t.merchant_name}</TableCell>}
              <TableCell className="tnum text-right">{eur(t.amount)}</TableCell>
              <TableCell className="tnum text-right">
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">-{pct(t.discount_percent)}</span>
                <span className="ml-2 text-muted-foreground">-{eur(t.discount_amount)}</span>
              </TableCell>
              <TableCell className="tnum text-right font-semibold">{eur(t.final_amount)}</TableCell>
              {showRating && (
                <TableCell className="text-center">
                  {onRate && Date.now() - new Date(t.created_at).getTime() < RATE_WINDOW_MS ? (
                    <Stars value={t.rating ?? 0} onChange={(n) => onRate(t, n)} testid={`rate-${t.id}`} />
                  ) : t.rating ? (
                    <Stars value={t.rating} testid={`rating-${t.id}`} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
