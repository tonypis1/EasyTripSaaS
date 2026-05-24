import { defineRouting } from "next-intl/routing";

/**
 * Configurazione centrale dei locali supportati.
 * - localePrefix: "always" => l'URL contiene sempre il prefisso lingua (es. /it/app, /en/app).
 * - localeDetection: true => al primo ingresso su "/" legge Accept-Language e cookie NEXT_LOCALE.
 */
export const routing = defineRouting({
  locales: ["it", "en", "es", "fr", "de"] as const,
  defaultLocale: "it",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type AppLocale = (typeof routing.locales)[number];
