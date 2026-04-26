import { Ticket } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchTripsForDashboard } from "@/lib/trips-data";
import { CreateTripForm } from "./create-trip-form";
import { DeleteTripButton } from "./delete-trip-button";
import { toDateOnlyIsoUtc } from "@/lib/calendar-date";
import { formatStatus, formatTripType } from "@/lib/day-unlock";

function toDateLabel(d: Date) {
  return toDateOnlyIsoUtc(d);
}

export default async function TripsPage() {
  const [trips, t] = await Promise.all([
    fetchTripsForDashboard(),
    getTranslations("app.trips.list"),
  ]);

  return (
    <div className="space-y-12">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">{t("hint")}</p>
      </div>

      <CreateTripForm />

      <section>
        <h2 className="font-display text-et-ink text-lg">{t("listHeading")}</h2>
        {trips.length === 0 ? (
          <p className="text-et-ink/55 mt-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {trips.map((tr) => (
              <li
                key={tr.id}
                className="border-et-border bg-et-card hover:border-et-accent/30 hover:bg-et-accent/5 relative rounded-2xl border transition"
              >
                <Link
                  href={`/app/trips/${tr.id}`}
                  className="block px-5 py-4 pr-[9.5rem] sm:pr-40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-et-ink text-lg">
                      {tr.destination}
                    </span>
                    <span className="text-et-ink/50 text-xs">
                      {toDateLabel(tr.startDate)} — {toDateLabel(tr.endDate)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="border-et-border text-et-ink/65 rounded-full border px-2 py-0.5">
                      {formatTripType(tr.tripType)}
                    </span>
                    <span className="border-et-border text-et-ink/65 rounded-full border px-2 py-0.5">
                      {formatStatus(tr.status)}
                    </span>
                    {tr.isPaid ? (
                      <span className="border-et-accent/30 bg-et-accent/10 text-et-accent rounded-full border px-2 py-0.5">
                        {t("paid")}
                      </span>
                    ) : (
                      <span className="border-et-border text-et-ink/45 rounded-full border px-2 py-0.5">
                        {t("unpaid")}
                      </span>
                    )}
                    {tr.localPassCityCount > 0 ? (
                      <span
                        className="border-amber-400/35 bg-amber-500/10 text-amber-100/95 inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                        title={t("localPassTitle")}
                      >
                        <Ticket
                          className="h-3 w-3 shrink-0 opacity-90"
                          aria-hidden
                        />
                        LocalPass · {tr.localPassCityCount}
                      </span>
                    ) : null}
                    {tr.activeDays > 0 ? (
                      <span className="border-et-border text-et-ink/55 rounded-full border px-2 py-0.5">
                        {t("activeDaysSuffix", { count: tr.activeDays })}
                      </span>
                    ) : null}
                  </div>
                </Link>
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 sm:top-1/2 sm:-translate-y-1/2">
                  <DeleteTripButton
                    tripId={tr.id}
                    destination={tr.destination}
                    isPaid={tr.isPaid}
                    startDate={toDateLabel(tr.startDate)}
                    status={tr.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
