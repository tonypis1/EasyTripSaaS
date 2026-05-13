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

/**
 * Origine HTTPS opzionale del Frontend API Clerk in produzione.
 * In produzione Clerk serve `clerk-js` da un sottodominio dedicato del tuo
 * sito (CNAME → Clerk), ad es. `https://clerk.easytripsaas.com`. Quel dominio
 * NON corrisponde a `*.clerk.com`, quindi senza autorizzazione esplicita la CSP
 * blocca lo script e il client mostra `failed_to_load_clerk_js_timeout`.
 *
 * Strategia:
 * 1) Se `NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN` è impostata, usala come override.
 * 2) Altrimenti deriva l'origine dal `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
 *    (Clerk codifica il dominio Frontend API in base64 dentro il publishable key,
 *    è ciò che fanno internamente i suoi SDK). Questo evita la dipendenza da
 *    una env var aggiuntiva che è facile dimenticare di propagare in produzione.
 */
function clerkFrontendApiOrigin(): string | null {
  return (
    clerkFrontendApiOriginFromEnv() ??
    clerkFrontendApiOriginFromPublishableKey()
  );
}

function clerkFrontendApiOriginFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * I publishable key Clerk hanno il formato `pk_<live|test>_<base64>` dove la
 * stringa base64 decodifica nel dominio Frontend API seguito da `$`
 * (es. `pk_live_Y2xlcmsuZWFzeXRyaXBzYWFzLmNvbSQ` → `clerk.easytripsaas.com$`).
 * Estraiamo quel dominio in modo difensivo e ritorniamo `null` se qualcosa non
 * combacia (test key locale, pk malformato, ecc.). Nessun throw: la CSP deve
 * sempre poter essere costruita.
 */
function clerkFrontendApiOriginFromPublishableKey(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!pk) return null;

  const match = pk.match(/^pk_(?:live|test)_(.+)$/);
  if (!match) return null;

  const encoded = match[1];
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }

  const domain = decoded.replace(/\$+$/, "").trim();
  if (!domain) return null;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain)) return null;
  if (!domain.includes(".")) return null;

  return `https://${domain}`;
}

function buildContentSecurityPolicy(
  portalOrigin: string | null,
  frontendApiOrigin: string | null,
): string {
  const portal = portalOrigin ? [portalOrigin] : [];
  const frontendApi = frontendApiOrigin ? [frontendApiOrigin] : [];

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
      ...frontendApi,
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
      "https://eu-assets.i.posthog.com",
      "https://us-assets.i.posthog.com",
      "https://*.crisp.chat",
      "wss://*.relay.crisp.chat",
      "wss://*.relay.rescue.crisp.chat",
      "https://*.basemaps.cartocdn.com",
      ...portal,
      ...frontendApi,
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
      ...frontendApi,
    ].join(" "),
  ].join("; ");
}

/**
 * Header di sicurezza per `next.config.ts` → `headers()`.
 * La CSP include:
 *  - l'origine dell'Account Portal Clerk se `NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_ORIGIN` è impostata
 *  - l'origine del Frontend API Clerk derivata, in ordine, da:
 *      1. `NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN` (override esplicito)
 *      2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (decodifica del dominio incluso nel pk)
 *    Così la CSP autorizza `clerk-js` anche senza una env var dedicata.
 */
export function getSecurityHeaderList(): { key: string; value: string }[] {
  const csp = buildContentSecurityPolicy(
    clerkAccountPortalOrigin(),
    clerkFrontendApiOrigin(),
  );
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
