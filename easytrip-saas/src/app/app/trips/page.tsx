import Link from "next/link";
import { fetchTripsForDashboard } from "@/lib/trips-data";
import { CreateTripForm } from "./create-trip-form";
import { formatStatus, formatTripType } from "@/lib/day-unlock";

function toDateLabel(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function TripsPage() {
  const trips = await fetchTripsForDashboard();

  return (
    <div className="space-y-12">
      <div className="border-l-2 border-et-accent/40 pl-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-et-accent/88">
          Itinerari
        </p>
        <h1 className="font-display mt-2 text-3xl font-normal tracking-tight text-et-ink sm:text-4xl">
          I miei viaggi
        </h1>
        <p className="mt-2 max-w-xl text-sm text-et-ink/65">
          Crea un viaggio, paga (o usa la scorciatoia dev), poi segui la generazione e lo
          sblocco giorno per giorno.
        </p>
      </div>

      <CreateTripForm />

      <section>
        <h2 className="font-display text-lg text-et-ink">Elenco</h2>
        {trips.length === 0 ? (
          <p className="mt-4 text-sm text-et-ink/55">
            Nessun viaggio ancora: usa il modulo sopra per crearne uno.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {trips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/trips/${t.id}`}
                  className="block rounded-2xl border border-et-border bg-et-card px-5 py-4 transition hover:border-et-accent/30 hover:bg-et-accent/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-lg text-et-ink">
                      {t.destination}
                    </span>
                    <span className="text-xs text-et-ink/50">
                      {toDateLabel(t.startDate)} — {toDateLabel(t.endDate)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-et-border px-2 py-0.5 text-et-ink/65">
                      {formatTripType(t.tripType)}
                    </span>
                    <span className="rounded-full border border-et-border px-2 py-0.5 text-et-ink/65">
                      {formatStatus(t.status)}
                    </span>
                    {t.isPaid ? (
                      <span className="rounded-full border border-et-accent/30 bg-et-accent/10 px-2 py-0.5 text-et-accent">
                        Pagato
                      </span>
                    ) : (
                      <span className="rounded-full border border-et-border px-2 py-0.5 text-et-ink/45">
                        Da pagare
                      </span>
                    )}
                    {t.activeDays > 0 ? (
                      <span className="rounded-full border border-et-border px-2 py-0.5 text-et-ink/55">
                        {t.activeDays} giorni in bozza
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
