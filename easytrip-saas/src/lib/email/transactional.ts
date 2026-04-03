import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";

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
      to: args.to,
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
