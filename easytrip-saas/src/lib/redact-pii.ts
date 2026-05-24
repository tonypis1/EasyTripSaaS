/**
 * Offuscamento di PII per log e contesti osservabilità (evita email in chiaro su Vercel/stdout).
 */

/** Maschera un indirizzo email: primo carattere locale + "***" + dominio (es. `j***@example.com`). */
export function redactEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return "[email_redacted]";
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}
