import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Caricatore dei messaggi per Server Components.
 * next-intl chiama questa funzione a ogni richiesta e ci passa il locale
 * estratto dall'URL (/[locale]/...). Se il locale non è valido ricadiamo su quello di default.
 *
 * I file messages/{it,en,es,fr,de}.json vengono importati dinamicamente per permettere
 * il code splitting: ogni utente scarica solo la propria lingua.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
