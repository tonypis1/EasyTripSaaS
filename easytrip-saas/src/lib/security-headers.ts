/**
 * Valori per Content-Security-Policy e header complementari (OWASP).
 * Aggiornare quando si aggiungono nuovi script/domini di terze parti (Clerk, Turnstile/CAPTCHA, PostHog, Crisp, mappe).
 *
 * Nota: Next.js usa script inline per l’idratazione; in molti setup restano necessari
 * 'unsafe-inline' / 'unsafe-eval' — per restringere ulteriormente usare nonce via middleware.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
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
  ].join(" "),
  // Crisp widget: worker da sottodominio crisp poi eseguito in blob:
  "worker-src 'self' blob: https://*.crisp.chat",
  [
    "frame-src 'self'",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
    "https://*.crisp.chat",
  ].join(" "),
].join("; ");

export const securityHeaderList: { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "X-Frame-Options", value: "DENY" },
];
