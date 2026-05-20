/**
 * URL pubblico dell'app per metadata Open Graph e link assoluti.
 * Non importa unifiedConfig: in layout/metadata serve un fallback sicuro se
 * APP_BASE_URL in Vercel è malformato (es. dominio senza https://).
 */
export function getMetadataBaseUrl(): URL {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw) {
    try {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(withScheme);
    } catch {
      /* valore non parsabile → fallback sotto */
    }
  }
  return new URL("http://localhost:3000");
}
