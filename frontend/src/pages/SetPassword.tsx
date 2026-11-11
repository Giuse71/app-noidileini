import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Crest from "@/components/Crest";
import { Field } from "@/components/ProfileFields";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { beginSession, homeFor, useAssociation } from "@/lib/session";
import type { Me, PasswordTokenInfo, SetPasswordIn } from "@/lib/types";

export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { data: assoc } = useAssociation();
  const info = useQuery({
    queryKey: ["password-token", token],
    queryFn: () => apiGet<PasswordTokenInfo>(`/auth/password-token/${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    retry: false,
  });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const save = useMutation({
    mutationFn: (b: SetPasswordIn) => apiPost<Me>("/auth/set-password", b),
    onSuccess: (me) => {
      beginSession(me);
      toast.success("Password impostata: benvenuto!");
      navigate(me.user.role === "merchant" ? "/commerciante/profilo" : homeFor(me.user.role), { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-navy px-4 py-10">
      <div className="w-full max-w-md animate-fade-up rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <Crest logo={assoc?.logo} />
          <div>
            <p className="font-bold text-navy">App Noi di Leyni</p>
            <p className="text-xs text-muted-foreground">{assoc?.name}</p>
          </div>
        </div>
        {!token || info.isError ? (
          <div className="mt-6 space-y-4" data-testid="set-password-invalid">
            <h1 className="text-xl font-semibold">Link non valido o scaduto</h1>
            <p className="text-sm text-muted-foreground">{info.isError ? errMsg(info.error) : "Manca il codice di invito."}</p>
            <Link to="/login" className={buttonVariants({ variant: "outline" })} data-testid="set-password-login-link">
              Vai all'accesso
            </Link>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pw !== pw2) return toast.error("Le due password non coincidono");
              save.mutate({ token, password: pw });
            }}
          >
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <KeyRound className="size-5 text-primary" /> Scegli la tua password
              </h1>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="set-password-account">
                {info.isLoading ? "Verifica del link…" : [info.data?.business_name, info.data?.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Field label="Nuova password" htmlFor="sp-pw" hint="Almeno 6 caratteri">
              <Input id="sp-pw" type="password" required minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="set-password-input" />
            </Field>
            <Field label="Ripeti la password" htmlFor="sp-pw2">
              <Input id="sp-pw2" type="password" required minLength={6} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} data-testid="set-password-confirm-input" />
            </Field>
            <Button type="submit" className="w-full" disabled={save.isPending || info.isLoading} data-testid="set-password-submit">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salva e accedi
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
