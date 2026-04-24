import Link from "next/link";
import "./globals.css";

/**
 * not-found root.
 *
 * Questo file viene mostrato quando la richiesta non ha un locale valido nel
 * path (es. utente che digita un URL a mano e next-intl non riesce a risolverlo).
 * Siccome vive FUORI da src/app/[locale]/layout.tsx, non eredita <html>/<body>
 * dal layout localizzato: deve quindi renderizzare la propria shell HTML.
 *
 * Manteniamo il testo in italiano (fallback): l'utente che arriva qui non ha
 * ancora una lingua risolta, e il default dell'app è `it`.
 */
export default function RootNotFound() {
  return (
    <html lang="it">
      <body className="bg-et-deep text-et-ink antialiased">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
          <div>
            <p className="text-et-accent text-sm font-semibold">EasyTrip</p>
            <h1 className="font-display mt-2 text-3xl tracking-tight">
              Pagina non trovata (404)
            </h1>
            <p className="text-et-ink/70 mt-3 text-sm leading-relaxed">
              L&apos;indirizzo non corrisponde a nessuna pagina dell&apos;app.
            </p>
          </div>
          <Link
            href="/"
            className="text-et-accent text-sm underline-offset-4 hover:underline"
          >
            Torna alla home
          </Link>
        </div>
      </body>
    </html>
  );
}
