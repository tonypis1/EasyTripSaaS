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
export const httpUrlSchema = z.string().url().refine(
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
