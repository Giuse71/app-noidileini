import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { InviteStats } from "@/lib/types";

/** Board card: the club's single invite link, shareable by copy, WhatsApp or printable QR. */
export default function InviteCard() {
  const link = `${window.location.origin}/invito`;
  const qrRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ["invite-stats"], queryFn: () => apiGet<InviteStats>("/admin/invite") });
  const message = `Ciao! Il Leinì Volley ha la sua app "Noi di Leyni": tessera digitale e sconti nei negozi convenzionati. Iscriviti qui: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiato");
    } catch {
      toast.error("Copia non riuscita: tieni premuto sul link per copiarlo");
    }
  }

  function print() {
    const svg = qrRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=700,height=900");
    if (!w) return toast.error("Consenti le finestre pop-up per stampare");
    w.document.write(`<!doctype html><html><head><title>Invito App Noi di Leyni</title><style>
      body{font-family:Arial,sans-serif;text-align:center;color:#1e3a8a;padding:48px}
      h1{font-size:34px;margin:0 0 8px} p{font-size:18px;color:#334155} svg{width:340px;height:340px;margin:32px auto}
      .url{font-weight:bold;font-size:16px;color:#1e3a8a;word-break:break-all}</style></head><body>
      <h1>Scarica App Noi di Leyni</h1><p>Inquadra il QR con la fotocamera e iscriviti come atleta o commerciante</p>
      ${svg}<p class="url">${link}</p><p>Leinì Volley</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const stats = [
    { label: "Aperture del link", value: data?.visits, id: "visits" },
    { label: "Atleti iscritti", value: data?.athletes, id: "athletes" },
    { label: "Commercianti iscritti", value: data?.merchants, id: "merchants" },
  ];

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" data-testid="invite-card">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-ink">Diffondi l'app</p>
            <h2 className="text-lg font-semibold">Link di invito del club</h2>
            <p className="text-sm text-muted-foreground">Un unico link per tutti: porta a una pagina di benvenuto dove si sceglie atleta o commerciante.</p>
          </div>
          <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm" data-testid="invite-link-text">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy} variant="outline" data-testid="invite-copy-button"><Copy className="size-4" /> Copia link</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
              className={buttonVariants({ className: "bg-[#25D366] text-white hover:bg-[#1ebe5a]" })} data-testid="invite-whatsapp-button">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <Button onClick={print} variant="outline" data-testid="invite-print-button"><Printer className="size-4" /> Stampa QR</Button>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.id} className="rounded-xl bg-accent/50 p-3">
                <dt className="text-[11px] leading-tight text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums" data-testid={`invite-stat-${s.id}`}>{s.value ?? "–"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div ref={qrRef} className="mx-auto shrink-0 rounded-xl border bg-white p-3" data-testid="invite-qr">
          <QRCodeSVG value={link} size={168} level="M" fgColor="#1e3a8a" />
        </div>
      </div>
    </section>
  );
}
