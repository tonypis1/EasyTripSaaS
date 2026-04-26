import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import {
  deDE as clerkDeDE,
  enUS as clerkEnUS,
  esES as clerkEsES,
  frFR as clerkFrFR,
  itIT as clerkItIT,
} from "@clerk/localizations";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Geist_Mono, Instrument_Serif, Manrope } from "next/font/google";
import PostHogProvider from "../posthog-provider";
import { routing, type AppLocale } from "@/i18n/routing";
import "../globals.css";

/**
 * Layout "per locale" dell'App Router.
 *
 * Vive sotto src/app/[locale]/layout.tsx: Next.js chiama questo layout per ogni
 * richiesta e ci passa il segmento dinamico {locale}. Qui dentro:
 *  1. valida che il locale sia uno di quelli supportati (altrimenti 404);
 *  2. imposta il locale per le funzioni server di next-intl (setRequestLocale);
 *  3. carica i messaggi JSON della lingua;
 *  4. monta <html lang={locale}> così screen reader e SEO vedono la lingua giusta;
 *  5. avvolge tutto in ClerkProvider (con la traduzione Clerk corrispondente)
 *     e in NextIntlClientProvider (per useTranslations nei Client Component).
 */

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Mappa locale -> bundle di stringhe UI di Clerk.
 * Clerk offre pacchetti separati per ogni lingua: passiamo quello giusto al
 * <ClerkProvider /> così bottoni "Sign in", "Forgot password", ecc. compaiono
 * nella lingua scelta dall'utente.
 */
const clerkLocalizations = {
  it: clerkItIT,
  en: clerkEnUS,
  es: clerkEsES,
  fr: clerkFrFR,
  de: clerkDeDE,
} as const satisfies Record<AppLocale, unknown>;

/**
 * Metadata dinamica per locale. Legge title/description dal bundle JSON della
 * lingua attiva (chiave `meta.root`) così ogni pagina che non definisce
 * generateMetadata proprio mostra comunque un titolo nella lingua dell'utente.
 * Le singole pagine (home, dashboard, ...) possono ancora sovrascrivere.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Se il locale non è supportato lasciamo che LocaleLayout mostri 404: qui
  // restituiamo un fallback neutro per non crashare durante la fase metadata.
  if (!hasLocale(routing.locales, locale)) {
    return {
      metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
      title: "EasyTrip",
      description: "AI travel itineraries",
    };
  }

  const t = await getTranslations({ locale, namespace: "meta.root" });
  return {
    metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
    title: t("title"),
    description: t("description"),
  };
}

/**
 * Indica a Next.js quali valori di [locale] deve pre-generare staticamente.
 * Rende tutte le rotte localizzate "statiche" per default, poi le pagine
 * che hanno dati dinamici (es. /app/*) opteranno per il rendering dinamico.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Se qualcuno prova /xx/... con un locale non supportato -> 404 pulito.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Abilita le API server di next-intl (getTranslations, getFormatter, ...) in
  // questa request senza dover leggere manualmente l'URL.
  setRequestLocale(locale);

  // Carica i messaggi JSON (it.json / en.json / ...) per il Client Provider.
  const messages = await getMessages();

  return (
    <ClerkProvider localization={clerkLocalizations[locale]}>
      <html lang={locale}>
        <body
          className={`${manrope.className} ${instrument.variable} ${manrope.variable} ${geistMono.variable} antialiased`}
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Suspense fallback={null}>
              <PostHogProvider>{children}</PostHogProvider>
            </Suspense>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
