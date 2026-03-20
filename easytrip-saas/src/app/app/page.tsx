import Link from "next/link";

export default function AppHomePage() {
  return (
    <div className="space-y-10">
      <div className="border-l-2 border-et-accent/40 pl-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-et-accent/88">
          Area riservata
        </p>
        <h1 className="font-display mt-2 text-3xl font-normal tracking-tight text-et-ink sm:text-4xl">
          La tua dashboard
        </h1>
      </div>
      <p className="max-w-xl text-base leading-relaxed text-et-ink/70">
        Crea un viaggio, completa il pagamento (o in sviluppo usa la scorciatoia
        senza Stripe), attendi la generazione e consulta i giorni con sblocco
        progressivo.
      </p>
      <Link
        href="/app/trips"
        className="inline-flex items-center justify-center rounded-xl border border-et-border bg-et-card px-5 py-3 text-sm font-semibold text-et-ink transition-colors duration-200 hover:border-et-accent/35 hover:bg-et-accent/10"
      >
        Vai ai viaggi →
      </Link>
    </div>
  );
}
