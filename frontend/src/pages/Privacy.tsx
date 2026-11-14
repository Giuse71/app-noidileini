import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Crest from "@/components/Crest";
import { useAssociation } from "@/lib/session";

const UPDATED = "novembre 2026";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" data-testid={`privacy-section-${n}`}>
      <h2 className="text-lg font-semibold text-primary">
        {n}. {title}
      </h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

/** Informativa privacy (art. 13 e 14 Reg. UE 2016/679 – GDPR). Owner data comes from Admin → Associazione. */
export default function Privacy() {
  const { data: a } = useAssociation();
  const owner = a?.name || "A.S.D. Leinì Volley";
  const contact = a?.email || "l'indirizzo email indicato nella pagina dell'associazione";
  return (
    <div className="min-h-dvh bg-background pt-safe">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="privacy-back-link">
          <ArrowLeft className="size-4" /> Torna all'app
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <Crest logo={a?.logo} className="size-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="privacy-title">Informativa sulla privacy</h1>
            <p className="text-sm text-muted-foreground">App Noi di Leyni · aggiornata a {UPDATED}</p>
          </div>
        </div>

        <div className="mt-8 space-y-7">
          <Section n={1} title="Titolare del trattamento">
            <p>
              Titolare è <strong>{owner}</strong>
              {a?.address ? `, ${a.address}` : ""}
              {a?.city ? `, ${a.city}` : ""}
              {a?.fiscal_code ? `, C.F. ${a.fiscal_code}` : ""}. Per qualsiasi richiesta sulla privacy puoi scrivere a <strong className="break-all">{contact}</strong>.
            </p>
          </Section>

          <Section n={2} title="Quali dati trattiamo">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Dati di accesso</strong>: email, password (conservata solo in forma cifrata), codici di accesso temporanei inviati via email.</li>
              <li><strong>Dati dell'atleta e dei familiari</strong>: nome, cognome, categoria, ruolo in squadra, foto del profilo, codice e QR della tessera, rapporto di parentela.</li>
              <li><strong>Dati dei commercianti</strong>: ragione sociale, P.IVA, indirizzo, contatti, logo e foto dell'attività, sconto e promozioni.</li>
              <li><strong>Dati d'uso della convenzione</strong>: acquisti scontati (data, importo, sconto, negozio), valutazioni a stelle, partner preferiti.</li>
              <li><strong>Dati tecnici</strong>: cookie tecnici di sessione, dispositivi fidati (tipo di browser e sistema, date di utilizzo), posizione del dispositivo solo se la autorizzi per "Vicino a me" (usata sul momento e non salvata).</li>
            </ul>
          </Section>

          <Section n={3} title="Dati sensibili e dati di minori">
            <p>
              L'app tratta <strong>dati sensibili e particolarmente delicati</strong>: fotografie che rendono riconoscibili le persone, dati di <strong>atleti minorenni</strong> e dei loro familiari, e informazioni sulle abitudini di acquisto. Per questo li trattiamo con misure di sicurezza rafforzate (vedi punto 7) e solo per le finalità indicate qui.
            </p>
            <p>
              Per gli atleti minori di 14 anni la registrazione e il consenso devono essere dati da chi esercita la responsabilità genitoriale. Non chiediamo né trattiamo dati sanitari: non inserirli nei campi liberi (ad esempio ruolo o categoria).
            </p>
          </Section>

          <Section n={4} title="Perché li trattiamo e su quale base">
            <ul className="list-disc space-y-1 pl-5">
              <li>Gestire la tessera digitale, la convenzione sponsor e gli sconti nei negozi partner — esecuzione del rapporto associativo (art. 6.1.b GDPR).</li>
              <li>Proteggere gli account con la doppia verifica e tenere il registro delle attività del Direttivo — legittimo interesse alla sicurezza (art. 6.1.f).</li>
              <li>Inviare report ai commercianti, notizie del club e avvisi su promozioni dei partner preferiti — rapporto associativo; puoi disattivare gli avvisi dal profilo.</li>
              <li>Pubblicare foto di partite ed eventi e le foto profilo — consenso (art. 6.1.a e art. 9.2.a per i dati particolari), revocabile in ogni momento.</li>
            </ul>
          </Section>

          <Section n={5} title="Chi può vedere i dati: permessi del Direttivo">
            <p>
              L'accesso ai dati è regolato da <strong>permessi specifici</strong>. Un <strong>supervisore</strong> assegna a ciascun membro del Direttivo solo le aree necessarie al suo compito (Atleti, Commercianti, Report e transazioni, Contenuti dell'associazione, Membri del Direttivo): un membro senza un'area non può vedere né modificare quei dati, e il controllo avviene sul server, non solo nell'app.
            </p>
            <p>
              I commercianti vedono solo i dati necessari ad applicare lo sconto (nome, categoria, foto e codice della tessera mostrata alla cassa) e le proprie transazioni. Gli atleti vedono solo i propri dati e quelli dei propri familiari. Ogni blocco di account, modifica dei permessi o unione di account viene registrato con autore, data e ora.
            </p>
          </Section>

          <Section n={6} title="Dispositivi fidati e cookie">
            <p>
              Dopo la password chiediamo un codice inviato via email. Se scegli "Ricorda questo dispositivo", un cookie tecnico lo memorizza come <strong>dispositivo fidato per trecento (300) giorni</strong>: per quel periodo il codice non verrà richiesto su quel dispositivo. In ogni momento puoi vedere e rimuovere i tuoi dispositivi fidati dall'icona del telefono nell'app; alla scadenza il dispositivo viene dimenticato automaticamente.
            </p>
            <p>Usiamo solo cookie tecnici necessari (sessione e dispositivo fidato), non cookie di profilazione o pubblicitari.</p>
          </Section>

          <Section n={7} title="Sicurezza">
            <p>
              Password cifrate, doppia verifica via email, link e codici monouso a scadenza, permessi per area, registro delle attività, connessioni cifrate (HTTPS), foto private accessibili solo agli aventi diritto, possibilità per il Direttivo di disattivare subito un account.
            </p>
          </Section>

          <Section n={8} title="Per quanto tempo li conserviamo">
            <ul className="list-disc space-y-1 pl-5">
              <li>Dati dell'account e della tessera: finché resti iscritto; dopo la disattivazione li conserviamo al massimo per il tempo richiesto dagli obblighi amministrativi e fiscali dell'associazione.</li>
              <li>Transazioni della convenzione: fino a 10 anni, per finalità contabili.</li>
              <li>Codici di accesso: 10 minuti · link di conferma email: 48 ore · dispositivi fidati: 300 giorni o fino alla rimozione.</li>
            </ul>
          </Section>

          <Section n={9} title="A chi possono essere comunicati">
            <p>
              Ai fornitori tecnici che ci aiutano a far funzionare l'app (hosting e database, invio delle email), nominati responsabili del trattamento. I dati non vengono venduti né usati per pubblicità. Alcuni fornitori possono trovarsi fuori dall'UE: in quel caso il trasferimento avviene con le garanzie previste dal GDPR (es. clausole contrattuali standard).
            </p>
          </Section>

          <Section n={10} title="I tuoi diritti">
            <p>
              Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento; puoi revocare il consenso in qualsiasi momento senza pregiudicare quanto fatto prima. Scrivi a <strong className="break-all">{contact}</strong>. Hai anche diritto di presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
