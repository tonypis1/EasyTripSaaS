import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-et-border bg-et-deep border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-et-accent text-lg font-normal tracking-tight">
              EasyTrip
            </div>
            <p className="text-et-ink/60 mt-2 text-sm">
              Itinerari AI per viaggi brevi in Europa. Pianifica in 30 secondi.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#come-funziona"
            >
              Come funziona
            </a>
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#prezzi"
            >
              Prezzi
            </a>
            <a className="text-et-ink/70 hover:text-et-ink text-sm" href="#faq">
              FAQ
            </a>
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/app"
            >
              Area riservata
            </Link>
          </div>
        </div>
        <div className="text-et-ink/45 mt-8 text-xs">
          © {new Date().getFullYear()} EasyTrip. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
