import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 bg-et-deep px-6 py-16 text-et-ink">
      <div>
        <p className="text-sm font-semibold text-et-accent">EasyTrip</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Pagina non trovata (404)</h1>
        <p className="mt-3 text-sm leading-relaxed text-et-ink/70">
          L’indirizzo non corrisponde a nessuna route dell’app. Controlla l’URL nella barra del
          browser: l’elenco viaggi è sotto{" "}
          <span className="font-mono text-et-ink">/app/trips</span>, non{" "}
          <span className="font-mono text-et-ink">/trips</span> (quest’ultimo ora reindirizza
          automaticamente).
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link href="/" className="text-et-accent underline-offset-4 hover:underline">
            Home
          </Link>
        </li>
        <li>
          <Link href="/app" className="text-et-accent underline-offset-4 hover:underline">
            Dashboard app
          </Link>
        </li>
        <li>
          <Link href="/app/trips" className="text-et-accent underline-offset-4 hover:underline">
            I miei viaggi (URL corretto)
          </Link>
        </li>
      </ul>
      <p className="text-xs text-et-ink/50">
        Se usi <span className="font-mono">npm run dev</span>, avvialo dalla cartella{" "}
        <span className="font-mono">easytrip-saas</span> e usa la porta indicata nel terminale
        (3000, 3001, …).
      </p>
    </div>
  );
}
