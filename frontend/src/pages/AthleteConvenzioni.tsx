import MerchantList from "@/components/MerchantList";
import { useAssociation } from "@/lib/session";

export default function AthleteConvenzioni() {
  const { data: assoc } = useAssociation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Convenzioni sponsor</h1>
        <p className="text-sm text-muted-foreground">{assoc?.convention_rules || "Mostra la tessera prima di pagare."}</p>
      </div>
      <MerchantList />
    </div>
  );
}
