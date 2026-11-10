import { useQuery } from "@tanstack/react-query";
import { BadgePercent, Euro, Receipt, Users } from "lucide-react";
import StatCard from "@/components/StatCard";
import TransactionsTable from "@/components/TransactionsTable";
import { apiGet } from "@/lib/api";
import { eur, totals } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function MerchantHistory() {
  const tx = useQuery({ queryKey: ["transactions", "mine"], queryFn: () => apiGet<Transaction[]>("/transactions/mine") });
  const rows = tx.isError ? [] : (tx.data ?? []);
  const t = totals(rows);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registro cassa</h1>
        <p className="text-sm text-muted-foreground">Tutte le vendite in convenzione registrate dalla tua attività</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Transazioni" value={String(t.count)} icon={Receipt} testid="merchant-stat-count" />
        <StatCard label="Incassato (netto)" value={eur(t.final)} icon={Euro} testid="merchant-stat-final" />
        <StatCard label="Sconti concessi" value={eur(t.discount)} icon={BadgePercent} accent testid="merchant-stat-discount" />
        <StatCard label="Atleti clienti" value={String(t.athletes)} icon={Users} testid="merchant-stat-athletes" />
      </div>
      <TransactionsTable rows={rows} showMerchant={false} testid="merchant-transactions" />
    </div>
  );
}
