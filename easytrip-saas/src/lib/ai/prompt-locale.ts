/**
 * Helper per prompt Claude localizzati.
 *
 * Obiettivo: ogni prompt inviato ad Anthropic deve contenere un'istruzione
 * esplicita sulla lingua di risposta, coerente con `User.language` memorizzata
 * in DB (impostata da `LocaleSwitcher` / cookie NEXT_LOCALE / webhook Clerk).
 *
 * Strategia:
 *  - Il SYSTEM prompt riceve una riga in inglese (istruzione "super-globale"
 *    per il modello: "Always respond in <LANG>, including all free-text fields
 *    and JSON string values").
 *  - Il USER prompt riceve una riga nella lingua target (così il modello vede
 *    anche un esempio di tono/linguaggio da usare).
 *
 * Nota: i *valori enum* (es. "pranzo"/"cena" negli schemi di generate-itinerary)
 * restano in italiano perché lo schema Zod lato backend li validerà come tali.
 * Tradotti sono solo i campi testuali liberi (why, tips, dowWarning, localGem,
 * contextNote, whyNotOriginal, ecc.).
 */

export type SupportedAiLocale = "it" | "en" | "es" | "fr" | "de";

const LANGUAGE_NAME_EN: Record<SupportedAiLocale, string> = {
  it: "Italian",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
};

const USER_LANGUAGE_REMINDER: Record<SupportedAiLocale, string> = {
  it: "Rispondi in italiano chiaro e concreto.",
  en: "Respond in clear, concrete English.",
  es: "Responde en español claro y concreto.",
  fr: "Réponds en français clair et concret.",
  de: "Antworte in klarem, konkretem Deutsch.",
};

const DEFAULT_LOCALE: SupportedAiLocale = "it";

/**
 * Normalizza un valore di lingua arbitrario (es. "it-IT", "EN", "de_AT", null)
 * su uno dei locali supportati. Fallback deterministico su italiano.
 */
export function normalizeAiLocale(
  input: string | null | undefined,
): SupportedAiLocale {
  if (!input) return DEFAULT_LOCALE;
  const short = input.toLowerCase().split(/[-_]/)[0];
  if (
    short === "it" ||
    short === "en" ||
    short === "es" ||
    short === "fr" ||
    short === "de"
  ) {
    return short;
  }
  return DEFAULT_LOCALE;
}

/**
 * Riga da appendere al SYSTEM prompt di Claude.
 * In inglese per massimizzare l'aderenza del modello all'istruzione.
 */
export function systemLanguageDirective(locale: SupportedAiLocale): string {
  const lang = LANGUAGE_NAME_EN[locale];
  return `Always write all free-text fields and JSON string values in ${lang}. This includes titles, descriptions, "why" fields, tips, warnings, and any narrative text. Keep enum-like values (meal types, slot names, status codes) exactly as specified in the schema.`;
}

/**
 * Riga da appendere al USER prompt, nella lingua target stessa.
 * Rinforza l'istruzione del system message con un esempio inline.
 */
export function userLanguageReminder(locale: SupportedAiLocale): string {
  return USER_LANGUAGE_REMINDER[locale];
}
