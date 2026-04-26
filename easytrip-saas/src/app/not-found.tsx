import Link from "next/link";

/**
 * not-found a livello app (es. percorso senza locale valido, prima che next-intl
 * possa reindirizzare). Eredita <html>/<body> da `src/app/layout.tsx`.
 * Testo in italiano (fallback) perché la lingua non è ancora risolta.
 */
export default function RootNotFound() {
  return (
    <div className="bg-et-deep text-et-ink mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
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
  );
}
