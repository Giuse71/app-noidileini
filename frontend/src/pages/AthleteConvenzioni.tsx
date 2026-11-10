import { List, Map } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MerchantList from "@/components/MerchantList";
import PartnersMap from "@/components/PartnersMap";
import { useAssociation } from "@/lib/session";

export default function AthleteConvenzioni() {
  const { data: assoc } = useAssociation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Convenzioni sponsor</h1>
        <p className="text-sm text-muted-foreground">{assoc?.convention_rules || "Mostra la tessera prima di pagare."}</p>
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" data-testid="convenzioni-tab-list"><List className="size-4" /> Elenco</TabsTrigger>
          <TabsTrigger value="map" data-testid="convenzioni-tab-map"><Map className="size-4" /> Mappa</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4"><MerchantList /></TabsContent>
        <TabsContent value="map" className="mt-4"><PartnersMap /></TabsContent>
      </Tabs>
    </div>
  );
}
