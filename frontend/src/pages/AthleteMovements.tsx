import { useQuery } from "@tanstack/react-query";
import { PiggyBank, Receipt, Wallet } from "lucide-react";
import StatCard from "@/components/StatCard";
import TransactionsTable from "@/components/TransactionsTable";
import { apiGet } from "@/lib/api";
import { eur, totals } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function AthleteMovements() {
  const tx = useQuery({ queryKey: ["transactions", "mine"], queryFn: () => apiGet<Transaction[]>("/transactions/mine") });
  const rows = tx.isError ? [] : (tx.data ?? []);
  const t = totals(rows);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">I miei movimenti</h1>
        <p className="text-sm text-muted-foreground">Gli acquisti con lo sconto della convenzione</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Risparmiato" value={eur(t.discount)} icon={PiggyBank} accent testid="movements-savings" />
        <StatCard label="Speso (netto)" value={eur(t.final)} icon={Wallet} testid="movements-spent" />
        <StatCard label="Acquisti" value={String(t.count)} icon={Receipt} testid="movements-count" />
      </div>
      <TransactionsTable rows={rows} showAthlete={false} emptyText="Non hai ancora usato la tessera: mostrala in un negozio partner!" testid="athlete-transactions" />
    </div>
  );
}
