import { Link } from "react-router-dom";
import { ArrowRight, BadgePercent, QrCode, ReceiptText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Crest from "@/components/Crest";
import MerchantList from "@/components/MerchantList";
import { homeFor, useAssociation, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: QrCode, title: "L'atleta mostra la tessera", text: "Ogni tesserato ha un QR personale nella propria area riservata." },
  { icon: BadgePercent, title: "Il commerciante applica lo sconto", text: "Scansiona il codice, inserisce l'importo: lo sconto della convenzione si calcola da solo." },
  { icon: ReceiptText, title: "Tutto resta tracciato", text: "Ogni transazione è registrata: l'associazione vede i benefici generati dagli sponsor." },
];

export default function Landing() {
  const { data: assoc } = useAssociation();
  const { data: me } = useMe();

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/60 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full bg-gold" />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-6 md:px-6 md:pb-24">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crest logo={assoc?.logo} className="size-11" testid="landing-logo" />
              <span className="text-sm font-semibold" data-testid="landing-association-name">
                {assoc?.name ?? "A.S.D. Leinì Volley"}
              </span>
            </div>
            {me ? (
              <Link to={homeFor(me.user.role)} className={buttonVariants({ variant: "secondary", size: "sm" })} data-testid="landing-area-button">
                La mia area
              </Link>
            ) : (
              <Link to="/login" className={buttonVariants({ variant: "secondary", size: "sm" })} data-testid="landing-login-button">
                Accedi
              </Link>
            )}
          </nav>

          <div className="mt-14 grid items-center gap-10 md:mt-20 md:grid-cols-[1.3fr_1fr]">
            <div className="animate-fade-up">
              <p className="inline-flex rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">Convenzione Sponsor</p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
                App Noi di Leyni
              </h1>
              <p className="mt-5 max-w-xl text-base text-blue-100 md:text-lg">
                La tessera digitale del Leinì Volley: atleti e famiglie risparmiano nei negozi partner, i commercianti sostengono la squadra e ogni sconto resta tracciato.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login?tab=atleta" className={cn(buttonVariants({ size: "lg" }), "bg-gold text-navy hover:bg-gold/90")} data-testid="landing-register-athlete">
                  Sono un atleta <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/login?tab=commerciante"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white")}
                  data-testid="landing-register-merchant"
                >
                  Sono un commerciante
                </Link>
              </div>
            </div>
            <div className="relative mx-auto hidden w-full max-w-xs md:block">
              <div className="rotate-3 rounded-2xl bg-white p-6 shadow-2xl">
                <Crest logo={assoc?.logo} className="mx-auto size-48" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-16 px-4 py-14 md:px-6">
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Come funziona</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="animate-fade-up rounded-xl border bg-card p-5" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-xs font-bold text-gold-ink">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">I nostri partner</h2>
              <p className="mt-1 text-sm text-muted-foreground">Attività di Leinì che sostengono la pallavolo locale</p>
            </div>
          </div>
          <div className="mt-6">
            <MerchantList limit={6} />
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 text-sm text-muted-foreground md:grid-cols-2 md:px-6" data-testid="landing-footer">
          <div className="flex items-start gap-3">
            <Crest logo={assoc?.logo} />
            <div>
              <p className="font-semibold text-foreground">{assoc?.name ?? "A.S.D. Leinì Volley"}</p>
              {assoc?.description && <p className="mt-1">{assoc.description}</p>}
            </div>
          </div>
          <div className="space-y-1 md:text-right">
            {(assoc?.address || assoc?.city) && <p>{[assoc?.address, assoc?.city].filter(Boolean).join(" · ")}</p>}
            {assoc?.email && <p>{assoc.email}</p>}
            {assoc?.phone && <p>{assoc.phone}</p>}
            {(assoc?.vat_number || assoc?.fiscal_code) && (
              <p>
                {assoc?.vat_number && `P.IVA ${assoc.vat_number}`} {assoc?.fiscal_code && `C.F. ${assoc.fiscal_code}`}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
