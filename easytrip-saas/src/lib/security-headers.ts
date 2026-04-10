/**
 * Valori per Content-Security-Policy e header complementari (OWASP).
 * Aggiornare quando si aggiungono nuovi script/domini di terze parti (Clerk, PostHog, Crisp, mappe).
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
    "https://client.crisp.chat",
    "https://eu-assets.i.posthog.com",
    "https://us-assets.i.posthog.com",
  ].join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: https://*.basemaps.cartocdn.com",
  [
    "connect-src 'self'",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "https://clerk-telemetry.com",
    "https://eu.i.posthog.com",
    "https://eu.posthog.com",
    "https://us.i.posthog.com",
    "https://client.crisp.chat",
    "wss://client.relay.crisp.chat",
    "wss://stream.relay.crisp.chat",
    "https://*.basemaps.cartocdn.com",
  ].join(" "),
  "worker-src 'self' blob:",
  [
    "frame-src 'self'",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
    "https://game.crisp.chat",
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
