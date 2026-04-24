import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";
import {
  daysLabel,
  formatEmailDate,
  normalizeEmailLocale,
  t as tr,
  type EmailLocale,
} from "./email-i18n";

export type { EmailLocale } from "./email-i18n";
export { normalizeEmailLocale } from "./email-i18n";

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
    logger.info(
      "Email marketing (mock — configura RESEND_API_KEY e EMAIL_FROM)",
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
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  return `
  <p>${tr("hello", locale)},</p>
  <p>${tr("purchaseConfirmed.body", locale, { destination: dest })}</p>
  <p>${tr("purchaseConfirmed.generating", locale)}</p>
  <p><a href="${params.tripUrl}">${tr("purchaseConfirmed.cta", locale)}</a></p>
  <p style="color:#666;font-size:12px">${tr("signature", locale)}</p>
  `.trim();
}

export function itineraryReadyHtml(params: {
  destination: string;
  tripUrl: string;
  geoScoreLabel: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const score = escapeHtml(params.geoScoreLabel);
  return `
  <p>${tr("hello", locale)},</p>
  <p>${tr("itineraryReady.title", locale, { destination: dest })}</p>
  <p>${tr("itineraryReady.efficiency", locale, { score })}</p>
  <p><a href="${params.tripUrl}">${tr("itineraryReady.cta", locale)}</a></p>
  <p style="color:#666;font-size:12px">${tr("signature", locale)}</p>
  `.trim();
}

export function cancelConfirmedHtml(params: {
  destination: string;
  creditAmount: number;
  creditExpiresAt: string;
  tripsUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const amount = `€${params.creditAmount.toFixed(2)}`;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">💳</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("cancelConfirmed.title", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("cancelConfirmed.body", locale, { amount })}
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <p style="margin:0 0 4px;font-size:13px;color:#15803d;font-weight:600">${tr("cancelConfirmed.creditLabel", locale)}</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#166534">${amount}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#16a34a">
        ${tr("cancelConfirmed.validUntil", locale, { date: escapeHtml(params.creditExpiresAt) })}
      </p>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("cancelConfirmed.usage", locale)}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("cancelConfirmed.cta", locale)}
        </a>
      </td></tr>
    </table>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("cancelConfirmed.footer", locale)}
    </p>
  </div>
  `.trim();
}

export function creditExpiryReminderHtml(params: {
  creditAmount: string;
  daysLeft: number;
  expiresAt: string;
  tripsUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const urgency =
    params.daysLeft <= 1 ? "🚨" : params.daysLeft <= 7 ? "⏰" : "📅";
  const urgencyColor =
    params.daysLeft <= 1
      ? "#dc2626"
      : params.daysLeft <= 7
        ? "#ea580c"
        : "#ca8a04";
  const daysText = daysLabel(params.daysLeft, locale);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">${urgency}</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("creditExpiry.title", locale, { days: daysText })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("creditExpiry.body", locale, { amount: escapeHtml(params.creditAmount) })}
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:#fffbeb;border-radius:10px;border:1px solid ${urgencyColor}40">
      <p style="margin:0 0 4px;font-size:13px;color:${urgencyColor};font-weight:600">
        ${tr("creditExpiry.expiryLabel", locale)}
      </p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${urgencyColor}">
        ${escapeHtml(params.expiresAt)}
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#888">
        ${tr("creditExpiry.afterNote", locale)}
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("creditExpiry.cta", locale)}
        </a>
      </td></tr>
    </table>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("creditExpiry.footer", locale)}
    </p>
  </div>
  `.trim();
}

export function tripExpiredHtml(params: {
  destination: string;
  tripUrl: string;
  newTripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🌅</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("tripExpired.title", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("tripExpired.body", locale)}
    </p>
    <p style="font-size:13px;color:#888;margin:16px 0 24px">
      ${tr("tripExpired.accessInfo", locale)}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#1a1a1a;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("tripExpired.reactivateCta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777;margin:0 0 24px">
      ${tr("tripExpired.reactivateBody", locale)}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:12px 28px;border:1.5px solid #84cc16;color:#4d7c0f;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("tripExpired.newTripCta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777;margin:0 0 32px">
      ${tr("tripExpired.newTripBody", locale)}
    </p>

    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("tripExpired.footer", locale)}
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
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const days = daysLabel(params.daysLeft, locale);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🗓️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("preTrip.title", locale, { destination: dest, days })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("preTrip.body", locale)}
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:2">
        <li>&#9745; ${tr("preTrip.checkDocuments", locale)}</li>
        <li>&#9745; ${tr("preTrip.checkCharger", locale)}</li>
        <li>&#9745; ${tr("preTrip.checkShoes", locale)}</li>
        <li>&#9745; ${tr("preTrip.checkApp", locale)}</li>
        <li>&#9745; ${tr("preTrip.checkWeather", locale)}</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("preTrip.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("preTrip.footer", locale)}
    </p>
  </div>
  `.trim();
}

export function tripStartTodayHtml(params: {
  destination: string;
  tripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">✈️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("tripStart.title", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("tripStart.body", locale)}
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1d4ed8">
        ${tr("tripStart.reminderLabel", locale)}
      </p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li>${tr("tripStart.reminder1", locale)}</li>
        <li>${tr("tripStart.reminder2", locale)}</li>
        <li>${tr("tripStart.reminder3", locale)}</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("tripStart.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      ${tr("tripStart.footerHint", locale)}
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("tripStart.footer", locale)}
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
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">💭</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("postTripFeedback.title", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("postTripFeedback.intro", locale)}
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("postTripFeedback.ask", locale)}
    </p>
    <div style="margin:20px 0;padding:16px 20px;background:#faf5ff;border-radius:10px;border:1px solid #e9d5ff">
      <p style="margin:0;font-size:14px;color:#7c3aed;font-weight:600">
        ${tr("postTripFeedback.nextLabel", locale)}
      </p>
      <p style="margin:6px 0 0;font-size:13px;color:#555;line-height:1.6">
        ${tr("postTripFeedback.nextBody", locale)}
      </p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("postTripFeedback.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("postTripFeedback.footer", locale)}
    </p>
  </div>
  `.trim();
}

export function postTripReengageHtml(params: {
  newTripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🌤️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("postTripReengage.title", locale)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("postTripReengage.body", locale)}
    </p>
    <div style="margin:16px 0;padding:16px 20px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#c2410c">
        ${tr("postTripReengage.ideasTitle", locale)}
      </p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
        <li>${tr("postTripReengage.idea1", locale)}</li>
        <li>${tr("postTripReengage.idea2", locale)}</li>
        <li>${tr("postTripReengage.idea3", locale)}</li>
      </ul>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.newTripUrl}"
           style="display:inline-block;padding:14px 32px;background:#ea580c;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("postTripReengage.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      ${tr("postTripReengage.closing", locale)}
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("postTripReengage.footer", locale)}
    </p>
  </div>
  `.trim();
}

// ========== REFERRAL ==========

export function referralSignupHtml(params: {
  referrerName: string;
  referredEmail: string;
  dashboardUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
    <h1 style="font-size:22px;margin:0 0 16px">${tr("referralSignup.title", locale)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralSignup.greeting", locale, { name: escapeHtml(params.referrerName) })}
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralSignup.body", locale, { email: escapeHtml(params.referredEmail) })}
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralSignup.reward", locale)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.dashboardUrl}"
           style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("referralSignup.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      ${tr("referralSignup.closing", locale)}
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("email.brandFooter", locale)}
    </p>
  </div>
  `.trim();
}

export function welcomeEmailHtml(params: {
  name: string | null;
  appUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const greet = params.name?.trim()
    ? escapeHtml(params.name.trim())
    : tr("hello", locale);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">👋</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("welcome.title", locale)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("welcome.body", locale, { greet })}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.appUrl}/app"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("welcome.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      ${tr("welcome.tip", locale)}
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("signature", locale)}
    </p>
  </div>
  `.trim();
}

export function abandonedCheckoutHtml(params: {
  destination: string;
  tripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🧳</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("abandonedCheckout.title", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("abandonedCheckout.body", locale)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#ea580c;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("abandonedCheckout.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("abandonedCheckout.footer", locale)}
    </p>
  </div>
  `.trim();
}

export function nurtureNoTripHtml(params: {
  phase: 3 | 7;
  appUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const title =
    params.phase === 3
      ? tr("nurture.title3", locale)
      : tr("nurture.title7", locale);
  const copy =
    params.phase === 3
      ? tr("nurture.body3", locale)
      : tr("nurture.body7", locale);
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
          ${tr("nurture.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("nurture.footer", locale)}
      <a href="${marketingUnsubscribeUrl()}">${tr("nurture.preferences", locale)}</a>.
    </p>
  </div>
  `.trim();
}

export function tripMemberJoinedMemberHtml(params: {
  destination: string;
  organizerName: string | null;
  tripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const org = params.organizerName?.trim()
    ? escapeHtml(params.organizerName.trim())
    : tr("memberJoined.organizerFallback", locale);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🤝</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("memberJoined.memberTitle", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("memberJoined.memberBody", locale, { organizer: org })}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("memberJoined.memberCta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("signature", locale)}
    </p>
  </div>
  `.trim();
}

export function tripMemberJoinedOrganizerHtml(params: {
  destination: string;
  memberEmail: string;
  tripUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const email = escapeHtml(params.memberEmail);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">👥</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("memberJoined.organizerTitle", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("memberJoined.organizerBody", locale, { email })}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("memberJoined.organizerCta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("signature", locale)}
    </p>
  </div>
  `.trim();
}

export function itineraryReadyMemberHtml(params: {
  destination: string;
  tripUrl: string;
  geoScoreLabel: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const dest = escapeHtml(params.destination);
  const score = escapeHtml(params.geoScoreLabel);
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#333">
    <p style="font-size:24px;margin-bottom:4px">🗺️</p>
    <h1 style="font-size:20px;font-weight:600;color:#222;margin:0 0 12px">
      ${tr("itineraryReady.memberTitle", locale, { destination: dest })}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("itineraryReady.efficiency", locale, { score })}
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555">
      ${tr("itineraryReady.memberNote", locale)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripUrl}"
           style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("itineraryReady.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("signature", locale)}
    </p>
  </div>
  `.trim();
}

export function referralRewardHtml(params: {
  referrerName: string;
  rewardAmount: number;
  creditExpiresAt: string;
  tripsUrl: string;
  locale?: string | null;
}): string {
  const locale = normalizeEmailLocale(params.locale);
  const amount = params.rewardAmount.toFixed(2);
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
    <h1 style="font-size:22px;margin:0 0 16px">${tr("referralReward.title", locale)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralSignup.greeting", locale, { name: escapeHtml(params.referrerName) })}
    </p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralReward.body", locale, { amount })}
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
      <p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">
        +&euro;${amount}
      </p>
      <p style="font-size:13px;color:#666;margin:4px 0 0">
        ${tr("referralReward.validUntil", locale, { date: escapeHtml(params.creditExpiresAt) })}
      </p>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#444">
      ${tr("referralReward.howToUse", locale)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 16px">
      <tr><td>
        <a href="${params.tripsUrl}"
           style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;
                  font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">
          ${tr("referralReward.cta", locale)}
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#777">
      ${tr("referralReward.closing", locale)}
    </p>
    <p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px">
      ${tr("email.brandFooter", locale)}
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
