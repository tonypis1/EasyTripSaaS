"use client";

import { Footprints, Route, Shuffle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  ItineraryGeoAnalysis,
  DayGeoAnalysis,
} from "@/lib/geo-optimization";
import type { SlotKey } from "@/lib/slot-vote";

const SLOT_LABEL_KEY = {
  morning: "slot.morning",
  afternoon: "slot.afternoon",
  evening: "slot.evening",
} as const satisfies Record<SlotKey, string>;

/** Oltre questa tratta massima la stima "a piedi" non è più realistica: si mostrano solo i km. */
const MAX_WALKABLE_LEG_KM = 3;

/** Come viene calcolato il GeoScore: km totali, km risparmiabili, giorni analizzati. */
export function GeoScoreDetails({ geo }: { geo: ItineraryGeoAnalysis }) {
  const td = useTranslations("app.trips.detail");
  const format = useFormatter();
  const km = (value: number) =>
    format.number(value, { maximumFractionDigits: 1 });

  return (
    <details
      className="group mt-2 max-w-xl text-xs"
      data-testid="geo-score-details"
    >
      <summary className="text-et-ink/55 hover:text-et-ink/80 inline-flex cursor-pointer list-none items-center gap-1.5 underline-offset-2 transition-colors hover:underline">
        <Route className="h-3.5 w-3.5" aria-hidden />
        {td("geo.detailsSummary")}
      </summary>
      <div className="border-et-border/60 bg-et-deep/40 text-et-ink/70 mt-2 space-y-1 rounded-xl border px-3.5 py-3">
        <p>{td("geo.totalKm", { km: km(geo.totalKm) })}</p>
        {geo.avoidableKm > 0 ? (
          <p>{td("geo.avoidableKm", { km: km(geo.avoidableKm) })}</p>
        ) : null}
        <p>
          {td("geo.daysAnalyzed", {
            scored: geo.scoredDays,
            total: geo.totalDays,
          })}
        </p>
        <p className="text-et-ink/45 pt-1">{td("geo.method")}</p>
      </div>
    </details>
  );
}

/** Riepilogo del percorso di un giorno, con il suggerimento di riordino quando conviene davvero. */
export function DayRouteSummary({ day }: { day: DayGeoAnalysis }) {
  const td = useTranslations("app.trips.detail");
  const format = useFormatter();
  const km = (value: number) =>
    format.number(value, { maximumFractionDigits: 1 });

  if (!day.scored) return null;

  const showWalk = day.longestLegKm <= MAX_WALKABLE_LEG_KM;
  const order = day.bestOrder.map((key) => td(SLOT_LABEL_KEY[key])).join(" → ");

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs"
      data-testid="day-route-summary"
    >
      <span className="border-et-border bg-et-deep text-et-ink/65 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
        <Footprints className="h-3 w-3" aria-hidden />
        {td("geo.dayRoute", { km: km(day.routeKm) })}
        {showWalk ? ` · ${td("geo.dayWalk", { min: day.walkMinutes })}` : ""}
      </span>
      {day.isOrderImprovable ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-amber-200/90"
          data-testid="day-route-suggestion"
        >
          <Shuffle className="h-3 w-3" aria-hidden />
          {td("geo.betterOrder", { order, km: km(day.avoidableKm) })}
        </span>
      ) : null}
    </div>
  );
}
