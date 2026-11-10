import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Crest from "@/components/Crest";
import { AthleteFields, Field, MerchantFields } from "@/components/ProfileFields";
import { apiPost } from "@/lib/api";
import { EMPTY_MERCHANT, errMsg } from "@/lib/format";
import { beginSession, homeFor, useAssociation, useMe } from "@/lib/session";
import type { AthleteRegister, Me, MerchantRegister } from "@/lib/types";

const DEMO = [
  { label: "Atleta di prova", email: "giulia.rossi@example.it", password: "Atleta2026!", testid: "demo-athlete" },
  { label: "Commerciante", email: "pizzeria@example.it", password: "Negozio2026!", testid: "demo-merchant" },
  { label: "Direttivo (admin)", email: "admin@leinivolley.it", password: "Admin2026!", testid: "demo-admin" },
];

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
  const [ath, setAth] = useState<AthleteRegister>({ email: "", password: "", first_name: "", last_name: "", category_id: "", photo: null, notify_new_partners: true });
  const [mer, setMer] = useState<MerchantRegister>({ ...EMPTY_MERCHANT, account_email: "", password: "" });

  const onSuccess = (data: Me) => {
    beginSession(data);
    toast.success("Benvenuto!");
    navigate(homeFor(data.user.role), { replace: true });
  };
  const onError = (e: unknown) => toast.error(errMsg(e));

  const login = useMutation({ mutationFn: (b: { email: string; password: string }) => apiPost<Me>("/auth/login", b), onSuccess, onError });
  const regAth = useMutation({ mutationFn: (b: AthleteRegister) => apiPost<Me>("/auth/register/athlete", b), onSuccess, onError });
  const regMer = useMutation({ mutationFn: (b: MerchantRegister) => apiPost<Me>("/auth/register/merchant", b), onSuccess, onError });

  if (me) return <Navigate to={homeFor(me.user.role)} replace />;

  function submitAthlete(e: FormEvent) {
    e.preventDefault();
    if (!ath.category_id) {
      toast.error("Seleziona la categoria di appartenenza");
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

      <main className="flex flex-col px-4 py-8 sm:px-8 lg:px-14">
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <Link to="/" data-testid="login-mobile-home-link">
            <Crest logo={assoc?.logo} />
          </Link>
          <div>
            <p className="font-bold text-navy">App Noi di Leyni</p>
            <p className="text-xs text-muted-foreground">{assoc?.name}</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl animate-fade-up">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full" data-testid="login-tabs">
              <TabsTrigger value="accedi" data-testid="tab-login">Accedi</TabsTrigger>
              <TabsTrigger value="atleta" data-testid="tab-register-athlete">Registrati atleta</TabsTrigger>
              <TabsTrigger value="commerciante" data-testid="tab-register-merchant">Registrati commerciante</TabsTrigger>
            </TabsList>

            <TabsContent value="accedi" className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Accedi alla tua area</h2>
                <p className="text-sm text-muted-foreground">Atleti, commercianti e direttivo usano lo stesso accesso.</p>
              </div>
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
              <div className="rounded-xl border border-dashed p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account dimostrativi</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEMO.map((d) => (
                    <Button key={d.testid} variant="outline" size="sm" disabled={login.isPending} onClick={() => login.mutate({ email: d.email, password: d.password })} data-testid={d.testid}>
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="atleta" className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Crea il tuo profilo atleta</h2>
                <p className="text-sm text-muted-foreground">Riceverai subito la tessera digitale con il QR personale.</p>
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
