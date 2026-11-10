import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PiggyBank, Receipt, Wallet } from "lucide-react";
import StatCard from "@/components/StatCard";
import TransactionsTable from "@/components/TransactionsTable";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, eur, totals } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { RatingIn, Transaction } from "@/lib/types";

export default function AthleteMovements() {
  const tx = useQuery({ queryKey: ["transactions", "mine"], queryFn: () => apiGet<Transaction[]>("/transactions/mine") });
  const rows = tx.isError ? [] : (tx.data ?? []);
  const t = totals(rows);
  const rate = useMutation({
    mutationFn: ({ id, stars }: { id: string; stars: number }) => apiPost<Transaction>(`/transactions/${id}/rating`, { stars } satisfies RatingIn),
    onSuccess: (tx) => {
      toast.success(`Grazie! Hai dato ${tx.rating} stelle a ${tx.merchant_name}`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
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
      <p className="text-sm text-muted-foreground">Valuta i tuoi acquisti con le stelle (entro 30 giorni): aiuti i partner a migliorare.</p>
      <TransactionsTable rows={rows} showAthlete={false} showRating onRate={(tx, stars) => rate.mutate({ id: tx.id, stars })} emptyText="Non hai ancora usato la tessera: mostrala in un negozio partner!" testid="athlete-transactions" />
    </div>
  );
}
