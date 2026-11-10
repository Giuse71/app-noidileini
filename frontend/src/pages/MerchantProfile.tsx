import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MerchantFields } from "@/components/ProfileFields";
import { apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { ME_KEY, useMe } from "@/lib/session";
import type { Merchant, MerchantUpdate } from "@/lib/types";

function ProfileForm({ merchant }: { merchant: Merchant }) {
  const { id: _id, created_at: _c, ...initial } = merchant;
  const [form, setForm] = useState<MerchantUpdate>(initial);
  const save = useMutation({
    mutationFn: (b: MerchantUpdate) => apiPut<Merchant>("/merchants/me", b),
    onSuccess: () => {
      toast.success("Dati attività aggiornati");
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form
      className="space-y-5 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <MerchantFields value={form} onChange={setForm} />
      <Button type="submit" disabled={save.isPending} data-testid="merchant-profile-save-button">
        {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva dati attività
      </Button>
    </form>
  );
}

export default function MerchantProfile() {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">La mia attività</h1>
        <p className="text-sm text-muted-foreground">Logo, dati aziendali e sconto della convenzione visibili agli atleti</p>
      </div>
      {me?.merchant && <ProfileForm merchant={me.merchant} />}
    </div>
  );
}
