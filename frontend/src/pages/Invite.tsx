import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Store, Users } from "lucide-react";
import Crest from "@/components/Crest";
import { apiPost } from "@/lib/api";
import { useAssociation } from "@/lib/session";

export const INVITE_FLAG = "lv_invite";

/** Public landing for the club's shared invite link: pick athlete or merchant sign-up. */
export default function Invite() {
  const { data: assoc } = useAssociation();

  useEffect(() => {
    if (sessionStorage.getItem(INVITE_FLAG)) return;
    sessionStorage.setItem(INVITE_FLAG, "1");
    localStorage.setItem(INVITE_FLAG, "1"); // remembered until sign-up, credited to the invite link
    apiPost("/invite/visit", {}).catch(() => undefined);
  }, []);

  const choices = [
    { to: "/login?tab=atleta", icon: Users, title: "Sono un atleta o un genitore", text: "Tessera digitale con QR e sconti nei negozi convenzionati.", id: "athlete" },
    { to: "/login?tab=commerciante", icon: Store, title: "Ho un'attività commerciale", text: "Diventa partner: fatti conoscere da atleti e famiglie del club.", id: "merchant" },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-navy px-4 py-10 text-white sm:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-primary/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-[22rem] rounded-full bg-gold/25 blur-3xl" />
      <div className="relative mx-auto max-w-3xl animate-fade-up">
        <Crest logo={assoc?.logo} className="size-20 rounded-2xl p-1" />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-gold" data-testid="invite-kicker">Sei stato invitato</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl" data-testid="invite-title">Entra in App Noi di Leyni</h1>
        <p className="mt-4 max-w-xl text-blue-100" data-testid="invite-subtitle">
          {assoc?.name ?? "Leinì Volley"} ti invita nella sua app: scegli come vuoi iscriverti, bastano due minuti.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {choices.map(({ to, icon: Icon, title, text, id }) => (
            <Link key={id} to={to} data-testid={`invite-choice-${id}`}
              className="group rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-[transform,background-color] duration-200 hover:-translate-y-1 hover:bg-white/15">
              <Icon className="size-7 text-gold" />
              <p className="mt-4 text-lg font-semibold">{title}</p>
              <p className="mt-1 text-sm text-blue-100">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold">
                Iscriviti <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm text-blue-100">
          Hai già un account? <Link to="/login" className="font-semibold text-white underline" data-testid="invite-login-link">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
