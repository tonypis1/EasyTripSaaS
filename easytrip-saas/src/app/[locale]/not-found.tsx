import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="bg-et-deep text-et-ink mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-et-accent text-sm font-semibold">EasyTrip</p>
        <h1 className="font-display mt-2 text-3xl tracking-tight">
          Pagina non trovata (404)
        </h1>
        <p className="text-et-ink/70 mt-3 text-sm leading-relaxed">
          L’indirizzo non corrisponde a nessuna route dell’app. Controlla l’URL
          nella barra del browser: l’elenco viaggi è sotto{" "}
          <span className="text-et-ink font-mono">/app/trips</span>, non{" "}
          <span className="text-et-ink font-mono">/trips</span> (quest’ultimo
          ora reindirizza automaticamente).
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link
            href="/"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            href="/app"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            Dashboard app
          </Link>
        </li>
        <li>
          <Link
            href="/app/trips"
            className="text-et-accent underline-offset-4 hover:underline"
          >
            I miei viaggi (URL corretto)
          </Link>
        </li>
      </ul>
      <p className="text-et-ink/50 text-xs">
        Se usi <span className="font-mono">npm run dev</span>, avvialo dalla
        cartella <span className="font-mono">easytrip-saas</span> e usa la porta
        indicata nel terminale (3000, 3001, …).
      </p>
    </div>
  );
}
