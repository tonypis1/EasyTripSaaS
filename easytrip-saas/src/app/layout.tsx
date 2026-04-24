import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist_Mono, Instrument_Serif, Manrope } from "next/font/google";
import { routing, type AppLocale } from "@/i18n/routing";
import "./globals.css";

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
 * Layout radice obbligatorio (App Router). Ogni rotta — inclusa app/not-found.tsx
 * a livello root — eredita da qui <html> e <body>. I layout sotto [locale] non
 * devono ridefinire questi tag.
 *
 * `lang` su <html>: il segmento `/[locale]/…` non è un param in questo file;
 * usiamo l’header `x-easytrip-locale` (middleware) e, in fallback, il cookie
 * `NEXT_LOCALE` così l’HTML SSR e i test E2E vedono `lang` coerente con l’URL.
 */
function resolveRootHtmlLang(
  fromMiddleware: string | null,
  fromCookie: string | null,
): string {
  const set = new Set(routing.locales);
  if (fromMiddleware && set.has(fromMiddleware as AppLocale)) {
    return fromMiddleware;
  }
  if (fromCookie && set.has(fromCookie as AppLocale)) {
    return fromCookie;
  }
  return routing.defaultLocale;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const h = await headers();
  const c = await cookies();
  const lang = resolveRootHtmlLang(
    h.get("x-easytrip-locale"),
    c.get("NEXT_LOCALE")?.value ?? null,
  );

  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${manrope.className} ${instrument.variable} ${manrope.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
