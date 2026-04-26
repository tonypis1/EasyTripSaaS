/**
 * Valori per Content-Security-Policy e header complementari (OWASP).
 * Aggiornare quando si aggiungono nuovi script/domini di terze parti (Clerk, Turnstile/CAPTCHA, PostHog, Crisp, mappe).
 *
 * Clerk — due casi importanti:
 * 1) **Account Portal su dominio dedicato** (es. `https://accounts.easytripsaas.com` da Dashboard → Paths).
 *    Non è `*.clerk.com` né `self` rispetto a `easytripsaas.com`: in modalità **modal** l’iframe
 *    viene bloccato se l’origine non è in `frame-src` / `connect-src` / `script-src`.
 *    Imposta `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN` (vedi `.env.example`).
 * 2) **Modalità redirect** sui bottoni Sign in / Sign up (vedi `clerk-locale-buttons.tsx`): niente iframe
 *    verso il portal → niente dipendenza CSP su `frame-src` per quel flusso.
 *
 * Nota: Next.js usa script inline per l’idratazione; in molti setup restano necessari
 * 'unsafe-inline' / 'unsafe-eval' — per restringere ulteriormente usare nonce via middleware.
 */

/** Origine HTTPS opzionale dell’Account Portal Clerk (dominio personalizzato). */
function clerkAccountPortalOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(portalOrigin: string | null): string {
  const portal = portalOrigin ? [portalOrigin] : [];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    ["form-action 'self'", ...portal].join(" "),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    [
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "https://*.clerk.com",
      "https://*.clerk.accounts.dev",
      "https://clerk.browser.com",
      "https://challenges.cloudflare.com",
      // Crisp: https://docs.crisp.chat/guides/others/whitelisting-our-systems/crisp-domain-names/
      "https://*.crisp.chat",
      "https://eu-assets.i.posthog.com",
      "https://us-assets.i.posthog.com",
      ...portal,
    ].join(" "),
    [
      "style-src 'self' 'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://challenges.cloudflare.com",
      "https://*.crisp.chat",
    ].join(" "),
    [
      "font-src 'self' https://fonts.gstatic.com data:",
      "https://*.crisp.chat",
    ].join(" "),
    "img-src 'self' data: blob: https: https://*.basemaps.cartocdn.com",
    "media-src 'self' blob: https://*.crisp.chat",
    [
      "connect-src 'self'",
      "https://*.clerk.com",
      "https://*.clerk.accounts.dev",
      "https://clerk-telemetry.com",
      "https://challenges.cloudflare.com",
      "https://eu.i.posthog.com",
      "https://eu.posthog.com",
      "https://us.i.posthog.com",
      "https://*.crisp.chat",
      "wss://*.relay.crisp.chat",
      "wss://*.relay.rescue.crisp.chat",
      "https://*.basemaps.cartocdn.com",
      ...portal,
    ].join(" "),
    // Crisp widget: worker da sottodominio crisp poi eseguito in blob:
    "worker-src 'self' blob: https://*.crisp.chat",
    [
      "frame-src 'self'",
      "https://*.clerk.com",
      "https://*.clerk.accounts.dev",
      "https://challenges.cloudflare.com",
      "https://*.crisp.chat",
      ...portal,
    ].join(" "),
  ].join("; ");
}

/**
 * Header di sicurezza per `next.config.ts` → `headers()`.
 * La CSP include l’origine del portal Clerk se `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN` è impostata.
 */
export function getSecurityHeaderList(): { key: string; value: string }[] {
  const csp = buildContentSecurityPolicy(clerkAccountPortalOrigin());
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self)",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
