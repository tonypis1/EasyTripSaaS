import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Middleware "intl": legge l'URL e decide se servire la pagina o fare redirect
 * aggiungendo il prefisso di lingua corretto (/it, /en, /fr, /de, /es).
 *
 * La scelta del locale segue questo ordine (definito in src/i18n/routing.ts):
 *   1. cookie NEXT_LOCALE (utente di ritorno)
 *   2. header Accept-Language del browser (prima visita)
 *   3. defaultLocale "it"
 */
const intlMiddleware = createIntlMiddleware(routing);

/**
 * Rotte che richiedono autenticazione Clerk.
 * Dato che ora gli URL hanno sempre il prefisso di lingua, il matcher deve
 * accettare qualsiasi locale prima di "/app".
 */
const isProtectedRoute = createRouteMatcher(["/(it|en|es|fr|de)/app(.*)"]);

/**
 * Composizione: prima Clerk stabilisce il contesto auth e protegge /app,
 * poi deleghiamo a next-intl la risoluzione del locale e il redirect.
 *
 * Nota: le rotte tecniche (api, trpc, inngest, webhooks) NON devono essere
 * prefissate di lingua. Le escludiamo dal middleware intl facendo passare
 * direttamente la richiesta senza toccarla.
 */
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  const { pathname } = req.nextUrl;

  // Le rotte tecniche saltano next-intl: niente prefisso lingua su /api, /trpc, ecc.
  const isTechnicalRoute =
    pathname.startsWith("/api") ||
    pathname.startsWith("/trpc") ||
    pathname.startsWith("/_next");

  if (isTechnicalRoute) {
    return;
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Escludi /api/webhooks/* (Stripe/Clerk): il body deve restare raw per la firma.
    "/((?!_next|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
