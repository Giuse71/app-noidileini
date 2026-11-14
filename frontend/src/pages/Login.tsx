import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Crest from "@/components/Crest";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";
import { AthleteFields, Field, MerchantFields } from "@/components/ProfileFields";
import { ApiError, apiPost } from "@/lib/api";
import { EMPTY_MERCHANT, errMsg } from "@/lib/format";
import { beginSession, homeFor, useAssociation, useMe } from "@/lib/session";
import type { AthleteRegister, LoginResult, Me, MerchantRegister, RegisterResult } from "@/lib/types";

function Credentials({ email, password, setEmail, setPassword, prefix }: { email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void; prefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Email" htmlFor={`${prefix}-email`}>
        <Input id={`${prefix}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid={`${prefix}-email-input`} />
      </Field>
      <Field label="Password" htmlFor={`${prefix}-password`} hint={prefix === "login" ? undefined : "Almeno 6 caratteri"}>
        <Input id={`${prefix}-password`} type="password" required minLength={6} autoComplete={prefix === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} data-testid={`${prefix}-password-input`} />
      </Field>
    </div>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: assoc } = useAssociation();
  const { data: me } = useMe();
  const initialTab = params.get("tab") === "atleta" ? "atleta" : params.get("tab") === "commerciante" ? "commerciante" : "accedi";
  const [tab, setTab] = useState(initialTab);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ath, setAth] = useState<AthleteRegister>({ email: "", password: "", first_name: "", last_name: "", category_id: "", category_custom: "", team_role: "", photo: null, notify_new_partners: true });
  const [mer, setMer] = useState<MerchantRegister>({ ...EMPTY_MERCHANT, account_email: "", password: "" });
  // address waiting for confirmation: after sign-up, or when login is refused because it isn't confirmed yet
  const [pending, setPending] = useState<string | null>(null);
  // second factor: emailed 6-digit code
  const [otp, setOtp] = useState<{ id: string; hint: string } | null>(null);
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);

  const onSuccess = (data: Me) => {
    beginSession(data);
    toast.success("Benvenuto!");
    navigate(homeFor(data.user.role), { replace: true });
  };
  const onError = (e: unknown) => toast.error(errMsg(e));

  const onRegistered = (r: RegisterResult) => {
    setPending(r.email);
    setTab("accedi");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const login = useMutation({
    mutationFn: (b: { email: string; password: string }) => apiPost<LoginResult>("/auth/login", b),
    onSuccess: (r) => {
      if (r.me) onSuccess(r.me);
      else if (r.challenge_id) {
        setCode("");
        setOtp({ id: r.challenge_id, hint: r.email_hint ?? "" });
      }
    },
    onError: (e, b) => {
      if (e instanceof ApiError && e.status === 403 && errMsg(e).startsWith("Conferma")) setPending(b.email.toLowerCase());
      onError(e);
    },
  });
  const regAth = useMutation({ mutationFn: (b: AthleteRegister) => apiPost<RegisterResult>("/auth/register/athlete", b), onSuccess: onRegistered, onError });
  const regMer = useMutation({ mutationFn: (b: MerchantRegister) => apiPost<RegisterResult>("/auth/register/merchant", b), onSuccess: onRegistered, onError });
  const verifyOtp = useMutation({
    mutationFn: () => apiPost<Me>("/auth/login/verify", { challenge_id: otp?.id, code, trust_device: trust }),
    onSuccess,
    onError,
  });
  const resendOtp = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/auth/login/resend", { challenge_id: otp?.id }),
    onSuccess: () => toast.success("Nuovo codice inviato"),
    onError,
  });
  const resend = useMutation({
    mutationFn: (to: string) => apiPost<{ ok: boolean }>("/auth/resend-verification", { email: to }),
    onSuccess: () => toast.success("Se l'account è in attesa di conferma, ti abbiamo inviato un nuovo link"),
    onError,
  });

  if (me) return <Navigate to={homeFor(me.user.role)} replace />;

  function submitAthlete(e: FormEvent) {
    e.preventDefault();
    if (!ath.category_id && !ath.category_custom.trim()) {
      toast.error("Scegli o scrivi la categoria di appartenenza");
      return;
    }
    regAth.mutate(ath);
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-primary/70 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2 text-sm text-blue-100 hover:text-white" data-testid="login-back-link">
          <ArrowLeft className="size-4" /> Torna alla home
        </Link>
        <div className="relative mt-auto">
          <Crest logo={assoc?.logo} className="size-28 rounded-2xl p-1" />
          <h1 className="mt-6 text-4xl font-bold tracking-tight">App Noi di Leyni</h1>
          <p className="mt-3 max-w-sm text-blue-100">{assoc?.convention_rules || "La convenzione sponsor del Leinì Volley, in tasca."}</p>
          <div className="mt-8 h-1.5 w-24 rounded-full bg-gold" />
        </div>
      </aside>

      <main className="flex min-w-0 flex-col px-4 py-8 sm:px-8 lg:px-14">
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <Link to="/" data-testid="login-mobile-home-link">
            <Crest logo={assoc?.logo} />
          </Link>
          <div>
            <p className="font-bold text-navy">App Noi di Leyni</p>
            <p className="text-xs text-muted-foreground">{assoc?.name}</p>
          </div>
        </div>

        <div className="mx-auto w-full min-w-0 max-w-2xl animate-fade-up">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full" data-testid="login-tabs">
              <TabsTrigger value="accedi" data-testid="tab-login">Accedi</TabsTrigger>
              <TabsTrigger value="atleta" data-testid="tab-register-athlete">
                <span className="sm:hidden">Atleta</span><span className="hidden sm:inline">Registrati atleta</span>
              </TabsTrigger>
              <TabsTrigger value="commerciante" data-testid="tab-register-merchant">
                <span className="sm:hidden">Commerciante</span><span className="hidden sm:inline">Registrati commerciante</span>
              </TabsTrigger>
            </TabsList>

            {pending && (
              <div className="mt-6 flex animate-fade-up gap-3 rounded-xl border border-primary/30 bg-accent/60 p-4" role="status" data-testid="verify-email-pending">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-semibold text-primary">Conferma la tua email per attivare l'account</p>
                  <p className="text-muted-foreground">
                    Abbiamo inviato un link a <strong className="break-all text-foreground">{pending}</strong>. Aprilo per completare la registrazione (controlla anche lo spam). Il link vale 48 ore.
                  </p>
                  <Button variant="link" size="sm" className="h-auto px-0" disabled={resend.isPending} onClick={() => resend.mutate(pending)} data-testid="verify-email-resend-button">
                    {resend.isPending && <Loader2 className="size-3.5 animate-spin" />} Non è arrivata? Invia di nuovo
                  </Button>
                </div>
              </div>
            )}

            <TabsContent value="accedi" className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Accedi alla tua area</h2>
                <p className="text-sm text-muted-foreground">Atleti, commercianti e direttivo usano lo stesso accesso.</p>
              </div>
              {otp ? (
                <form
                  className="space-y-4 rounded-xl border bg-card p-5 animate-fade-up"
                  onSubmit={(e) => {
                    e.preventDefault();
                    verifyOtp.mutate();
                  }}
                  data-testid="login-otp-form"
                >
                  <div className="rounded-xl border border-primary/30 bg-accent/60 p-4 text-sm">
                    <p className="font-semibold text-primary">Doppia verifica</p>
                    <p className="text-muted-foreground">
                      Ti abbiamo inviato un codice di 6 cifre a <strong className="break-all text-foreground">{otp.hint}</strong>. Vale 10 minuti (controlla anche lo spam).
                    </p>
                  </div>
                  <Field label="Codice di accesso" htmlFor="login-otp">
                    <Input
                      id="login-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
                      data-testid="login-otp-input"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4 accent-primary" data-testid="login-otp-trust" />
                    Ricorda questo dispositivo per 30 giorni
                  </label>
                  <Button type="submit" className="w-full" disabled={verifyOtp.isPending || code.length !== 6} data-testid="login-otp-submit">
                    {verifyOtp.isPending && <Loader2 className="size-4 animate-spin" />} Conferma e accedi
                  </Button>
                  <div className="flex justify-between gap-2 text-sm">
                    <Button type="button" variant="link" className="h-auto px-0" onClick={() => setOtp(null)} data-testid="login-otp-back">
                      Indietro
                    </Button>
                    <Button type="button" variant="link" className="h-auto px-0" disabled={resendOtp.isPending} onClick={() => resendOtp.mutate()} data-testid="login-otp-resend">
                      Invia un nuovo codice
                    </Button>
                  </div>
                </form>
              ) : (
              <form
                className="space-y-5 rounded-xl border bg-card p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  login.mutate({ email, password });
                }}
              >
                <Credentials prefix="login" email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                <Button type="submit" className="w-full" disabled={login.isPending} data-testid="login-submit-button">
                  {login.isPending && <Loader2 className="size-4 animate-spin" />} Accedi
                </Button>
              </form>
              )}
              {!otp && <ForgotPasswordDialog initialEmail={email} />}
            </TabsContent>

            <TabsContent value="atleta" className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Crea il tuo profilo atleta</h2>
                <p className="text-sm text-muted-foreground">Dopo la conferma dell'email riceverai la tessera digitale con il QR personale.</p>
              </div>
              <form className="space-y-5 rounded-xl border bg-card p-5" onSubmit={submitAthlete}>
                <AthleteFields value={ath} onChange={(v) => setAth({ ...ath, ...v })} />
                <Credentials
                  prefix="athlete-register"
                  email={ath.email}
                  password={ath.password}
                  setEmail={(v) => setAth({ ...ath, email: v })}
                  setPassword={(v) => setAth({ ...ath, password: v })}
                />
                <Button type="submit" className="w-full" disabled={regAth.isPending} data-testid="athlete-register-submit-button">
                  {regAth.isPending && <Loader2 className="size-4 animate-spin" />} Registrati e ottieni la tessera
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="commerciante" className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Aderisci alla convenzione</h2>
                <p className="text-sm text-muted-foreground">Inserisci i dati della tua attività e lo sconto riservato ai tesserati.</p>
              </div>
              <form
                className="space-y-5 rounded-xl border bg-card p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  regMer.mutate(mer);
                }}
              >
                <MerchantFields value={mer} onChange={(v) => setMer({ ...mer, ...v })} showMap={false} />
                <div className="border-t pt-5">
                  <p className="mb-3 text-sm font-medium">Credenziali di accesso</p>
                  <Credentials
                    prefix="merchant-register"
                    email={mer.account_email}
                    password={mer.password}
                    setEmail={(v) => setMer({ ...mer, account_email: v })}
                    setPassword={(v) => setMer({ ...mer, password: v })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={regMer.isPending} data-testid="merchant-register-submit-button">
                  {regMer.isPending && <Loader2 className="size-4 animate-spin" />} Registra la mia attività
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
