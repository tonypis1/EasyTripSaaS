import { z } from "zod";

/**
 * URL prodotti dal modello AI (bookingLink, ecc.) e poi renderizzati come
 * `<a href>` cliccabile lato client. `z.string().url()` da solo non basta:
 * il parser WHATWG `URL` usato da zod considera sintatticamente validi anche
 * schemi come `javascript:`/`data:`/`vbscript:`, che se cliccati eseguirebbero
 * codice nell'origin dell'app (XSS). Se un input utente (destinazione, stile)
 * finito nel prompt riuscisse a indurre il modello a produrre un simile
 * schema, questo validator lo scarta prima che raggiunga il DB o la UI.
 */
export const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "L'URL deve usare il protocollo http o https" },
  );

/**
 * Domini noti di piattaforme di prenotazione/biglietteria. `httpUrlSchema`
 * garantisce solo uno schema http(s) sicuro: non impedisce al modello di
 * produrre un `bookingLink` sintatticamente valido ma inventato (una pagina
 * che non esiste). Un dominio qui sotto è trattato in UI come "verificato"
 * (CTA primaria); qualunque altro dominio — spesso il sito ufficiale
 * legittimo di un singolo POI, non elencabile in anticipo — resta
 * cliccabile ma con un trattamento visivo distinto ("link esterno non
 * verificato"), invece di essere scartato: rifiutarlo scartrebbe anche i
 * casi legittimi che questa allow-list non può prevedere.
 */
const KNOWN_BOOKING_DOMAINS = [
  "getyourguide.com",
  "thefork.it",
  "thefork.com",
  "viator.com",
  "tiqets.com",
  "booking.com",
  "musement.com",
  "headout.com",
  "civitatis.com",
  "ticketmaster.com",
] as const;

/** true se l'hostname dell'URL è uno dei domini noti (o un loro sottodominio). */
export function isKnownBookingDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return KNOWN_BOOKING_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
