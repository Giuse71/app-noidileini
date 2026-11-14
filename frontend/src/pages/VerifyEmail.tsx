import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import Crest from "@/components/Crest";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { beginSession, homeFor, useAssociation } from "@/lib/session";
import type { Me } from "@/lib/types";

/** Landing page of the confirmation link: activates the account and signs the user in. */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: assoc } = useAssociation();
  const token = params.get("token") ?? "";
  // a cached one-shot query (not a mutation) so StrictMode/remounts never fire the single-use token twice
  const verify = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => apiPost<Me>("/auth/verify-email", { token }),
    enabled: token !== "",
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const me = verify.data;

  useEffect(() => {
    if (!me) return;
    beginSession(me);
    toast.success("Email confermata: benvenuto!");
    const t = window.setTimeout(() => navigate(homeFor(me.user.role), { replace: true }), 900);
    return () => window.clearTimeout(t);
  }, [me, navigate]);

  const failed = !token || verify.isError;
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 pt-safe">
      <div className="w-full max-w-md animate-fade-up rounded-2xl border bg-card p-8 text-center shadow-sm" data-testid="verify-email-card">
        <Crest logo={assoc?.logo} className="mx-auto size-16" />
        {failed ? (
          <>
            <XCircle className="mx-auto mt-6 size-10 text-destructive" />
            <h1 className="mt-3 text-xl font-semibold">Link non valido</h1>
            <p className="mt-2 text-sm text-muted-foreground" data-testid="verify-email-error">
              {token ? errMsg(verify.error) : "Manca il codice di conferma nel link."}
            </p>
            <Link to="/login" className={buttonVariants({ className: "mt-6" })} data-testid="verify-email-login-link">
              Vai all'accesso
            </Link>
          </>
        ) : verify.isSuccess ? (
          <>
            <CheckCircle2 className="mx-auto mt-6 size-10 text-primary" />
            <h1 className="mt-3 text-xl font-semibold" data-testid="verify-email-success">Email confermata</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ti stiamo portando nella tua area…</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mt-6 size-10 animate-spin text-primary" />
            <h1 className="mt-3 text-xl font-semibold">Conferma in corso…</h1>
          </>
        )}
      </div>
    </div>
  );
}
