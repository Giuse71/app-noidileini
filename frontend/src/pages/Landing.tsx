import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgePercent, QrCode, ReceiptText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Crest from "@/components/Crest";
import MerchantList from "@/components/MerchantList";
import { homeFor, useAssociation, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import type { EventPhoto } from "@/lib/types";

const STEP_ICONS = [QrCode, BadgePercent, ReceiptText];

export default function Landing() {
  const { data: assoc } = useAssociation();
  const { data: me } = useMe();
  const photos = useQuery({ queryKey: ["event-photos", "public"], queryFn: () => apiGet<EventPhoto[]>("/event-photos") });
  const strip = photos.isError ? [] : (photos.data ?? []);
  const steps = assoc
    ? [
        { title: assoc.step1_title, text: assoc.step1_text },
        { title: assoc.step2_title, text: assoc.step2_text },
        { title: assoc.step3_title, text: assoc.step3_text },
      ].filter((s) => s.title || s.text)
    : [];

  return (
    <div className="min-h-dvh bg-background">
      <header className="pt-safe px-safe relative overflow-hidden bg-navy text-white">
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
              {assoc?.home_badge && (
                <p className="inline-flex rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy" data-testid="landing-badge">
                  {assoc.home_badge}
                </p>
              )}
              <h1 className="mt-5 whitespace-pre-line text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl" data-testid="landing-title">
                {assoc?.home_title ?? "App Noi di Leyni"}
              </h1>
              <p className="mt-5 max-w-xl whitespace-pre-line text-base text-blue-100 md:text-lg" data-testid="landing-subtitle">
                {assoc?.home_subtitle}
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
              {assoc?.hero_image ? (
                <img src={assoc.hero_image} alt="" className="aspect-square w-full rotate-3 rounded-2xl object-cover shadow-2xl" data-testid="landing-hero-image" />
              ) : (
                <div className="rotate-3 rounded-2xl bg-white p-6 shadow-2xl">
                  <Crest logo={assoc?.logo} className="mx-auto size-48" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-16 px-4 py-14 md:px-6">
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Come funziona</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i] ?? QrCode;
              return (
              <div key={i} className="animate-fade-up rounded-xl border bg-card p-5" style={{ animationDelay: `${i * 80}ms` }} data-testid={`landing-step-${i + 1}`}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-xs font-bold text-gold-ink">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
              );
            })}
          </div>
        </section>

        {strip.length > 0 && (
          <section data-testid="landing-event-strip">
            <h2 className="text-2xl font-semibold tracking-tight">Partite ed eventi</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gli ultimi momenti del Leinì Volley</p>
            <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
              {strip.map((p, i) => (
                <figure
                  key={p.id}
                  className="w-64 shrink-0 snap-start overflow-hidden rounded-xl border bg-card shadow-sm transition-transform duration-200 hover:-translate-y-1 md:w-72"
                  style={{ transform: i % 2 ? "rotate(0.6deg)" : "rotate(-0.6deg)" }}
                  data-testid={`landing-event-photo-${p.id}`}
                >
                  <img src={p.image} alt={p.caption || "Foto evento"} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  {p.caption && <figcaption className="px-3 py-2 text-sm font-medium">{p.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight" data-testid="landing-partners-title">{assoc?.partners_title ?? "I nostri partner"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{assoc?.partners_subtitle}</p>
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
