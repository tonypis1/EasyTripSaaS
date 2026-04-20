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
    logger.info(
      "Email transazionale (mock — configura RESEND_API_KEY e EMAIL_FROM)",
      {
        to: redactEmail(args.to),
        subject: args.subject,
      },
    );
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

const marketingUnsubscribeUrl = () =>
  `${config.app.baseUrl}/app/account/privacy`;

/**
 * Email marketing (opt-in esplicito). Header List-Unsubscribe verso pagina preferenze.
 */
export async function sendMarketingEmail(args: SendArgs): Promise<void> {
  const key = config.email.resendApiKey;
  const from = config.email.from;
  const unsub = marketingUnsubscribeUrl();
  if (!key || !from) {
    logger.info("Email marketing (mock — configura RESEND_API_KEY e EMAIL_FROM)", {
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
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("Resend marketing error", new Error(text), {
      status: res.status,
    });
    throw new Error(`Invio email marketing fallito: ${res.status}`);
  }
}

export function purchaseConfirmedHtml(params: {
  destination: string;
  tripUrl: string;
}): string {
  return `
  <p>Ciao,</p>
  <p>Abbiamo ricevuto il pagamento per il viaggio verso <strong>${escapeHtml(
    params.destination,
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
  const urgency =
    params.daysLeft <= 1 ? "🚨" : params.daysLeft <= 7 ? "⏰" : "📅";
  const urgencyColor =
    params.daysLeft <= 1
      ? "#dc2626"
      : params.daysLeft <= 7
        ? "#ea580c"
        : "#ca8a04";
  const daysText =
    params.daysLeft === 1 ? "1 giorno" : `${params.daysLeft} giorni`;
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

export function postTripReengageHtml(params: { newTripUrl: string }): string {
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

export function welcomeEmailHtml(params: {
  name: string | null;
  appUrl: string;
}): string {
  const greet = params.name?.trim()
    ? escapeHtml(params.name.trim())
    : "Ciao";
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">👋</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Benvenuto in EasyTrip
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${greet}, siamo felici di averti qui. EasyTrip trasforma la tua destinazione in un itinerario giorno per giorno,
      con mappe, ristoranti e consigli su misura.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.appUrl}/app"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Apri l&apos;app
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      Suggerimento: crea il tuo primo viaggio in pochi secondi dalla dashboard.
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip
    </p>
  </div>
  `.trim();
}

export function abandonedCheckoutHtml(params: {
  destination: string;
  tripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🧳</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Il checkout per ${dest} non &egrave; stato completato
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Il pagamento &egrave; ancora in sospeso. Puoi tornare al viaggio e concludere l&apos;acquisto quando vuoi:
      l&apos;itinerario AI ti aspetta.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#ea580c;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Completa il pagamento
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip &mdash; Se hai gi&agrave; pagato, ignora questa email.
    </p>
  </div>
  `.trim();
}

export function nurtureNoTripHtml(params: {
  phase: 3 | 7;
  appUrl: string;
}): string {
  const title =
    params.phase === 3
      ? "Hai già pensato alla prossima destinazione?"
      : "Ti manca solo un clic per il primo itinerario";
  const copy =
    params.phase === 3
      ? "Sono passati alcuni giorni dalla registrazione: se vuoi, crea il tuo primo viaggio e ricevi un piano giorno per giorno."
      : "Un weekend, una settimana o una gita fuori porta: EasyTrip organizza tutto in base alle tue date e al tuo stile.";
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">✨</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${title}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${copy}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.appUrl}/app/trips?new=1"
           style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Crea un viaggio
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      Hai ricevuto questa email perch&eacute; hai scelto di ricevere comunicazioni da EasyTrip.
      Puoi cambiare idea in qualsiasi momento: <a href="${marketingUnsubscribeUrl()}">preferenze privacy</a>.
    </p>
  </div>
  `.trim();
}

export function tripMemberJoinedMemberHtml(params: {
  destination: string;
  organizerName: string | null;
  tripUrl: string;
}): string {
  const dest = escapeHtml(params.destination);
  const org = params.organizerName?.trim()
    ? escapeHtml(params.organizerName.trim())
    : "l&apos;organizzatore";
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🤝</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Sei nel gruppo: ${dest}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${org} ti ha aggiunto al viaggio. Puoi vedere itinerario e spese condivise nell&apos;app.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Apri il viaggio
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip
    </p>
  </div>
  `.trim();
}

export function tripMemberJoinedOrganizerHtml(params: {
  destination: string;
  memberEmail: string;
  tripUrl: string;
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">👥</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Nuovo membro per ${escapeHtml(params.destination)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      <strong>${escapeHtml(params.memberEmail)}</strong> &egrave; entrato nel gruppo del viaggio.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Vedi il gruppo
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip
    </p>
  </div>
  `.trim();
}

export function itineraryReadyMemberHtml(params: {
  destination: string;
  tripUrl: string;
  geoScoreLabel: string;
}): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🗺️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      Itinerario pronto &mdash; ${escapeHtml(params.destination)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Il piano del viaggio &egrave; stato generato. Efficienza percorso (stima AI): <strong>${escapeHtml(params.geoScoreLabel)}</strong>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      Come membro del gruppo puoi consultare giorno per giorno attivit&agrave; e mappa dall&apos;app.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          Apri l&apos;itinerario
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      EasyTrip
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
