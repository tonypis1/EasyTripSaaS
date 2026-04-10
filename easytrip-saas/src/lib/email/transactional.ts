import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Invio email via Resend (https://resend.com). Senza `RESEND_API_KEY` solo log in dev.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<void> {
  const key = config.email.resendApiKey;
  const from = config.email.from;
  if (!key || !from) {
    logger.info("Email transazionale (mock — configura RESEND_API_KEY e EMAIL_FROM)", {
      to: redactEmail(args.to),
      subject: args.subject,
    });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("Resend API error", new Error(text), { status: res.status });
    throw new Error(`Invio email fallito: ${res.status}`);
  }
}

export function purchaseConfirmedHtml(params: {
  destination: string;
  tripUrl: string;
}): string {
  return `
  <p>Ciao,</p>
  <p>Abbiamo ricevuto il pagamento per il viaggio verso <strong>${escapeHtml(
    params.destination
  )}</strong>.</p>
  <p>Stiamo generando il tuo itinerario: riceverai un'altra email appena sarà pronto.</p>
  <p><a href="${params.tripUrl}">Apri il viaggio in EasyTrip</a></p>
  <p style="color:#666;font-size:12px">EasyTrip</p>
  `.trim();
}

export function itineraryReadyHtml(params: {
  destination: string;
  tripUrl: string;
  geoScoreLabel: string;
}): string {
  return `
  <p>Ciao,</p>
  <p>Il tuo itinerario per <strong>${escapeHtml(params.destination)}</strong> è pronto.</p>
  <p>Efficienza percorso (stima AI): <strong>${escapeHtml(params.geoScoreLabel)}</strong></p>
  <p><a href="${params.tripUrl}">Vedi l'itinerario</a></p>
  <p style="color:#666;font-size:12px">EasyTrip</p>
  `.trim();
}

export function cancelConfirmedHtml(params: {
  destination: string;
  creditAmount: number;
  creditExpiresAt: string;
  tripsUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  const amount = `€${params.creditAmount.toFixed(2)}`;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">💳</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Viaggio a ${dest} cancellato
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Abbiamo cancellato il tuo viaggio. Non preoccuparti: l'importo pagato è
      stato convertito in <strong style="color:#16a34a">${amount} di credito EasyTrip</strong>.
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <p style="margin:0 0 4px;font-size:13px;color:#15803d;font-weight:600">Il tuo credito</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#166534">${amount}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#16a34a">
        Valido fino al ${escapeHtml(params.creditExpiresAt)}
      </p>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      Puoi usare il credito per il prossimo viaggio. Sarà applicato
      automaticamente al checkout.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🌍 Pianifica il prossimo viaggio
        </a>
      </td></tr>
    </table>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip — Il credito viene applicato automaticamente al checkout.
      Ti invieremo un promemoria prima della scadenza.
    </p>
  </div>
  `.trim();
}

export function creditExpiryReminderHtml(params: {
  creditAmount: string;
  daysLeft: number;
  expiresAt: string;
  tripsUrl: string;
}): string {
  const urgency = params.daysLeft <= 1 ? "🚨" : params.daysLeft <= 7 ? "⏰" : "📅";
  const urgencyColor = params.daysLeft <= 1 ? "#dc2626" : params.daysLeft <= 7 ? "#ea580c" : "#ca8a04";
  const daysText = params.daysLeft === 1 ? "1 giorno" : `${params.daysLeft} giorni`;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">${urgency}</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Il tuo credito EasyTrip scade tra ${daysText}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Hai ancora <strong style="color:#16a34a">${escapeHtml(params.creditAmount)}</strong>
      di credito da usare. Non lasciarlo scadere!
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#fffbeb;border-radius:10px;border:1px solid ${urgencyColor}40">
      <p style="margin:0 0 4px;font-size:13px;color:${urgencyColor};font-weight:600">
        Scadenza credito
      </p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${urgencyColor}">
        ${escapeHtml(params.expiresAt)}
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#888">
        Dopo questa data, il credito non sarà più utilizzabile.
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🌍 Usa il credito — pianifica un viaggio
        </a>
      </td></tr>
    </table>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip — Il credito viene applicato automaticamente al checkout.
    </p>
  </div>
  `.trim();
}

export function tripExpiredHtml(params: {
  destination: string;
  tripUrl: string;
  newTripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🌅</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Il tuo viaggio a ${dest} è stato indimenticabile
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Ogni viaggio lascia un segno. I luoghi che hai scoperto, i sapori che hai
      assaggiato, i momenti che hai vissuto — sono tutti qui, pronti per essere
      rivissuti.
    </p>
    <p style="font-size:13px;color:#888;margin:16px 0 24px">
      L'accesso al tuo itinerario è scaduto, ma i ricordi restano per sempre.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#1a1a1a;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          📖 Rileggi i ricordi — €2,90
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777;margin:0 0 24px">
      Riattiva l'accesso completo per 30 giorni e rivivi ogni giorno del viaggio.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:12px 28px;border:1.5px solid #84cc16;color:#4d7c0f;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🌍 Nuovo viaggio — sconto 20%
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777;margin:0 0 32px">
      Hai già vissuto la magia di un itinerario su misura. La prossima avventura ti aspetta.
    </p>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip — Il tuo itinerario è al sicuro. Puoi riattivare l'accesso in qualsiasi momento.
    </p>
  </div>
  `.trim();
}

/* ─────────────────────────────────────────────────────────────
   WAITLIST DRIP — 5 email in 7 giorni
   ───────────────────────────────────────────────────────────── */

export function waitlistWelcomeHtml(params: { signupUrl: string }): string {
  void params.signupUrl;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">👋</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Sei dentro. Ti aspettavamo.
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      La tua iscrizione &egrave; confermata. Non c&rsquo;&egrave; nient&rsquo;altro
      da fare per ora &mdash; nessun link da cliccare, nessun account da creare.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Stiamo costruendo qualcosa che cambier&agrave; il modo in cui pianifichi i tuoi
      viaggi. Quando sar&agrave; il momento, sarai tra i primi a provarlo.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Nel frattempo, nei prossimi giorni ti racconteremo perch&eacute; lo stiamo
      costruendo e cosa lo rende diverso da tutto il resto.
    </p>
    <p style="font-size:13px;color:#888;margin-top:20px">
      A domani,<br/>
      Il team EasyTrip
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      Questa &egrave; l&rsquo;unica email di conferma. Niente spam, promesso.
    </p>
  </div>
  `.trim();
}

export function waitlistValuePropHtml(params: { signupUrl: string }): string {
  void params.signupUrl;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🇵🇹</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Come ho pianificato Lisbona in 32 secondi
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      La settimana scorsa abbiamo fatto un test: pianificare un weekend a Lisbona
      per due persone, stile foodie, budget moderato.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      <strong>Risultato: 32 secondi.</strong> Non minuti. Secondi.
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#475569">Cosa ha generato l&rsquo;AI:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li><strong>Giorno 1 mattina:</strong> Pastéis de Belém + Torre de Belém (percorso a piedi ottimizzato)</li>
        <li><strong>Pranzo:</strong> Cervejaria Ramiro &mdash; &ldquo;Prenota alle 12:30, dopo è coda di 45 min&rdquo;</li>
        <li><strong>Pomeriggio:</strong> Alfama + Miradouro da Graça (tramonto perfetto alle 18:40)</li>
        <li><strong>Cena:</strong> Taberna da Rua das Flores &mdash; €18/persona, menu degustazione</li>
      </ul>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      Ogni attivit&agrave; con orari, mappa interattiva, coordinate GPS, consigli
      pratici (&ldquo;porta scarpe comode per le salite di Alfama&rdquo;) e link per prenotare.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Quanto tempo ci avresti messo tu?
    </p>

    <p style="font-size:13px;color:#888;margin-top:20px">
      Domani non ti scrivo. Ci risentiamo tra 2 giorni.
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      EasyTrip &mdash; Pianifica meno, vivi di pi&ugrave;.
    </p>
  </div>
  `.trim();
}

export function waitlistFeaturesHtml(params: { signupUrl: string }): string {
  void params.signupUrl;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🤔</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Il problema che TripAdvisor non risolver&agrave; mai
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Hai presente quando cerchi &ldquo;cosa fare a Roma in 3 giorni&rdquo;?
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Trovi 47 blog con le stesse 10 attrazioni, nessun ordine logico,
      zero indicazioni su quanto camminare tra un punto e l&rsquo;altro,
      e ristoranti consigliati che hanno chiuso 2 anni fa.
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#dc2626">Il vero problema:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li>Le guide non sanno che luned&igrave; i musei sono chiusi</li>
        <li>Non ottimizzano il percorso (zigzag attraverso la citt&agrave;)</li>
        <li>Non adattano i consigli al TUO stile e budget</li>
        <li>Non ti aiutano se qualcosa va storto durante il viaggio</li>
      </ul>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      EasyTrip risolve tutto questo. L&rsquo;AI sa che il Colosseo &egrave; meno
      affollato il marted&igrave; mattina, che dopo il Pantheon il miglior pranzo
      &egrave; a 200 metri (non dall&rsquo;altra parte della citt&agrave;), e che
      se piove il giorno 2, ci sono 3 alternative indoor a 5 minuti a piedi.
    </p>

    <p style="font-size:14px;line-height:1.6;color:#555;font-weight:600">
      Non &egrave; un altro blog di viaggio. &Egrave; il tuo assistente personale.
    </p>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      EasyTrip &mdash; Il viaggio intelligente.
    </p>
  </div>
  `.trim();
}

export function waitlistSocialProofHtml(params: { signupUrl: string }): string {
  void params.signupUrl;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🎁</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Invita un amico &rarr; 1 trip gratis
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      I viaggi migliori si fanno in compagnia. E se potessi regalare a un amico
      la stessa esperienza che stai per scoprire?
    </p>

    <div style="margin:20px 0;padding:20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#16a34a">
        Come funziona:
      </p>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:2">
        <li>Rispondi a questa email con l&rsquo;email del tuo amico</li>
        <li>Quando si iscrive alla waitlist, entrambi salite in lista</li>
        <li>Al lancio: <strong style="color:#16a34a">il tuo primo trip &egrave; gratis</strong></li>
      </ol>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      Nessun codice, nessun link complicato. Basta un&rsquo;email.
      Pi&ugrave; amici inviti, pi&ugrave; vantaggi ottieni.
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#fefce8;border-radius:10px;border:1px solid #fde68a">
      <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.6">
        <strong>Perch&eacute; lo facciamo?</strong> Perch&eacute; sappiamo che chi
        viaggia con amici che usano EasyTrip ha un&rsquo;esperienza 10 volte migliore.
        E perch&eacute; il passaparola vale pi&ugrave; di qualsiasi pubblicit&agrave;.
      </p>
    </div>

    <p style="font-size:13px;color:#888;margin-top:20px">
      Ci risentiamo tra 2 giorni con l&rsquo;ultima email della serie.
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      EasyTrip &mdash; I viaggi migliori si condividono.
    </p>
  </div>
  `.trim();
}

export function waitlistFinalCtaHtml(params: { signupUrl: string }): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">✈️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Dove vai il prossimo weekend?
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      &Egrave; passata una settimana. Probabilmente hai gi&agrave; pensato a
      qualche destinazione, vero?
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#f5f3ff;border-radius:10px;border:1px solid #ddd6fe">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7c3aed">Idee per iniziare:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li><strong>Weekend romantico:</strong> Firenze, 2 giorni, stile culturale</li>
        <li><strong>Avventura con amici:</strong> Barcellona, 4 giorni, stile nightlife</li>
        <li><strong>Relax in famiglia:</strong> Costiera Amalfitana, 3 giorni, stile panoramico</li>
        <li><strong>City break veloce:</strong> Amsterdam, 2 giorni, stile foodie</li>
      </ul>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      Qualunque sia la tua scelta, EasyTrip ti crea l&rsquo;itinerario perfetto
      in meno di un minuto. Con mappa, ristoranti, orari ottimizzati e assistente
      GPS per il giorno del viaggio.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 16px">
      <tr><td>
        <a href="${params.signupUrl}"
           style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🚀 Crea il tuo primo viaggio
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Bastano 30 secondi. Nessuna carta di credito richiesta per iniziare.
    </p>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      Questa &egrave; l&rsquo;ultima email della serie. Da qui in poi, solo
      aggiornamenti importanti. Buon viaggio!<br/>
      EasyTrip &mdash; Il tuo compagno di viaggio AI.
    </p>
  </div>
  `.trim();
}

/* ─────────────────────────────────────────────────────────────
   PRE-TRIP — countdown & buon viaggio
   ───────────────────────────────────────────────────────────── */

export function preTripCountdownHtml(params: {
  destination: string;
  daysLeft: number;
  tripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  const days = params.daysLeft === 1 ? "1 giorno" : `${params.daysLeft} giorni`;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🗓️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Il viaggio a ${dest} inizia tra ${days}!
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Manca pochissimo! Ecco una mini checklist per partire sereno:
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:2">
        <li>&#9745; Documenti e carta d&rsquo;identit&agrave;</li>
        <li>&#9745; Caricatore telefono e power bank</li>
        <li>&#9745; Scarpe comode (camminerai molto!)</li>
        <li>&#9745; App EasyTrip aperta e pronta</li>
        <li>&#9745; Controllare il meteo della destinazione</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          📋 Rivedi il tuo itinerario
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Buona preparazione!
    </p>
  </div>
  `.trim();
}

export function tripStartTodayHtml(params: {
  destination: string;
  tripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">✈️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Buon viaggio a ${dest}!
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Oggi &egrave; il grande giorno! Il tuo itinerario &egrave; sbloccato e pronto.
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1d4ed8">
        Ricorda:
      </p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li>Apri l&rsquo;itinerario del giorno per vedere attivit&agrave; e mappa</li>
        <li>Usa il bottone <strong>&ldquo;Cosa faccio adesso?&rdquo;</strong> se qualcosa va storto</li>
        <li>Controlla i ristoranti consigliati per pranzo e cena</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🗺️ Apri il tuo itinerario
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Buon divertimento! Ogni giorno del viaggio si sblocca automaticamente.
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Il tuo compagno di viaggio AI.
    </p>
  </div>
  `.trim();
}

/* ─────────────────────────────────────────────────────────────
   POST-TRIP FOLLOW-UP
   ───────────────────────────────────────────────────────────── */

export function postTripFeedbackHtml(params: {
  destination: string;
  newTripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">💭</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Com&rsquo;&egrave; andato il viaggio a ${dest}?
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Speriamo che il tuo viaggio sia stato indimenticabile! I luoghi, i sapori,
      le persone &mdash; ogni viaggio lascia qualcosa di speciale.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Ti &egrave; piaciuto l&rsquo;itinerario? C&rsquo;&egrave; stato un posto che
      ti ha sorpreso? Un ristorante da ricordare? Ci farebbe piacere saperlo
      &mdash; rispondi a questa email con un pensiero.
    </p>
    <div style="margin:20px 0;padding:16px 20px;background:#faf5ff;border-radius:10px;border:1px solid #e9d5ff">
      <p style="margin:0;font-size:14px;color:#7c3aed;font-weight:600">
        Hai gi&agrave; in mente la prossima destinazione?
      </p>
      <p style="margin:6px 0 0;font-size:13px;color:#555;line-height:1.6">
        Pianifica il prossimo viaggio in 30 secondi e parti di nuovo alla scoperta.
      </p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          🌍 Pianifica il prossimo viaggio
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Ogni viaggio &egrave; un ricordo da custodire.
    </p>
  </div>
  `.trim();
}

export function postTripReengageHtml(params: {
  newTripUrl: string;
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🌤️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Dove vai il prossimo weekend?
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Sono passate due settimane dal tuo ultimo viaggio. La routine pu&ograve; aspettare,
      la prossima avventura no.
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#c2410c">
        Idee per un weekend veloce:
      </p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li>🇮🇹 Un borgo italiano che non conosci ancora</li>
        <li>🇪🇸 Una citt&agrave; europea a 2 ore di volo</li>
        <li>🏔️ Montagna o lago per staccare dalla citt&agrave;</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:14px 32px;background:#ea580c;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ✨ Crea un itinerario in 30 secondi
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Il tuo prossimo viaggio &egrave; a un clic di distanza.
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Viaggia di pi&ugrave;, pianifica di meno.
    </p>
  </div>
  `.trim();
}

// ========== REFERRAL ==========

export function referralSignupHtml(params: {
  referrerName: string;
  referredEmail: string;
  dashboardUrl: string;
}): string {
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
    <h1 style="font-size:22px;margin:0 0 16px">🎉 Il tuo amico si &egrave; registrato!</h1>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Ciao <strong>${escapeHtml(params.referrerName)}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Ottima notizia! <strong>${escapeHtml(params.referredEmail)}</strong> si &egrave;
      registrato su EasyTrip grazie al tuo link di invito.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Quando acquister&agrave; il primo viaggio, riceverai automaticamente
      <strong>&euro;9,99 di credito</strong> (= 1 trip gratis!) sul tuo account.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.dashboardUrl}"
           style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Vedi i tuoi inviti
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Continua a condividere il tuo link per guadagnare pi&ugrave; trip gratis!
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Viaggia di pi&ugrave;, pianifica di meno.
    </p>
  </div>
  `.trim();
}

export function referralRewardHtml(params: {
  referrerName: string;
  rewardAmount: number;
  creditExpiresAt: string;
  tripsUrl: string;
}): string {
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
    <h1 style="font-size:22px;margin:0 0 16px">🎁 Hai guadagnato 1 trip gratis!</h1>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Ciao <strong>${escapeHtml(params.referrerName)}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Un tuo amico ha appena acquistato il primo viaggio su EasyTrip!
      Come promesso, abbiamo accreditato <strong>&euro;${params.rewardAmount.toFixed(2)}</strong>
      sul tuo account.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
      <p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">
        +&euro;${params.rewardAmount.toFixed(2)}
      </p>
      <p style="font-size:13px;color:#666;margin:4px 0 0">
        Credito valido fino al ${params.creditExpiresAt}
      </p>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Usa il credito per il tuo prossimo viaggio &mdash; sar&agrave; applicato
      automaticamente al checkout!
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ✨ Crea il tuo prossimo viaggio gratis
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Continua a invitare amici per guadagnare ancora!
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Viaggia di pi&ugrave;, pianifica di meno.
    </p>
  </div>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
