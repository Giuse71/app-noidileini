import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AthleteFields } from "@/components/ProfileFields";
import { apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { ME_KEY, useMe } from "@/lib/session";
import type { Athlete, AthleteUpdate } from "@/lib/types";

function ProfileForm({ athlete }: { athlete: Athlete }) {
  const [form, setForm] = useState<AthleteUpdate>({
    first_name: athlete.first_name,
    last_name: athlete.last_name,
    category_id: athlete.category_id ?? "",
    category_custom: athlete.category_id ? "" : athlete.category_name,
    team_role: athlete.team_role,
    photo: athlete.photo,
    notify_new_partners: athlete.notify_new_partners,
  });
  const save = useMutation({
    mutationFn: (b: AthleteUpdate) => apiPut<Athlete>("/athletes/me", b),
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.category_id && !form.category_custom.trim()) {
      toast.error("Scegli o scrivi la categoria");
      return;
    }
    save.mutate(form);
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
      <AthleteFields value={form} onChange={setForm} />
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={form.notify_new_partners}
          onCheckedChange={(v) => setForm({ ...form, notify_new_partners: v === true })}
          data-testid="athlete-notify-checkbox"
        />
        <span>
          <span className="font-medium">Avvisami via email dei nuovi partner</span>
          <span className="block text-xs text-muted-foreground">Ricevi un messaggio quando un nuovo commerciante entra nella convenzione</span>
        </span>
      </label>
      <div className="rounded-lg bg-muted p-3 text-sm">
        <span className="text-muted-foreground">Email di accesso: </span>
        <span className="font-medium" data-testid="athlete-profile-email">{athlete.email}</span>
        <span className="ml-3 text-muted-foreground">Codice tessera: </span>
        <span className="tnum font-mono font-medium" data-testid="athlete-profile-code">{athlete.code}</span>
      </div>
      <Button type="submit" disabled={save.isPending} data-testid="athlete-profile-save-button">
        {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva profilo
      </Button>
    </form>
  );
}

export default function AthleteProfile() {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Il mio profilo</h1>
        <p className="text-sm text-muted-foreground">Foto e categoria compaiono sulla tessera digitale</p>
      </div>
      {me?.athlete && <ProfileForm athlete={me.athlete} />}
    </div>
  );
}
