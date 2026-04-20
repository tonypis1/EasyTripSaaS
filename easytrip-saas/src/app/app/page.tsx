import Link from "next/link";

export default function AppHomePage() {
  return (
    <div className="space-y-10">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          Area riservata
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          La tua dashboard
        </h1>
      </div>
      <p className="text-et-ink/70 max-w-xl text-base leading-relaxed">
        Crea un viaggio, completa il pagamento, attendi la generazione e consulta i giorni con sblocco
        progressivo.
      </p>
      <Link
        href="/app/trips"
        className="border-et-border bg-et-card text-et-ink hover:border-et-accent/35 hover:bg-et-accent/10 inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition-colors duration-200"
      >
        Vai ai viaggi →
      </Link>
    </div>
  );
}
