import type { DayPlanExtended } from "@/lib/itinerary-model-schema";
import type { GroundedDestination } from "./grounding-schema";

/** Minuscolo, senza diacritici né punteggiatura: "Trattoria Da Enzo al 29" ~ "trattoria da enzo al 29". */
export function normalizePlaceName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Uguaglianza, oppure contenimento reciproco per nomi abbastanza lunghi da non produrre falsi positivi ("Duomo" vs "Duomo di Milano"). */
function namesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.includes(short);
}

export type GroundingCoverage = {
  pois: { matched: number; total: number };
  restaurants: { matched: number; total: number };
};

/**
 * Quanti POI (title degli slot) e ristoranti dell'itinerario generato
 * compaiono tra quelli verificati: misura di quanto il modello si è appoggiato
 * alle fonti. Copertura bassa sui ristoranti = probabile invenzione di nomi.
 * Serve come telemetria, non blocca la generazione.
 */
export function computeGroundingCoverage(
  days: Pick<
    DayPlanExtended,
    "morning" | "afternoon" | "evening" | "restaurants"
  >[],
  grounding: GroundedDestination,
): GroundingCoverage {
  const knownAttractions = grounding.areas.flatMap((a) =>
    a.attractions.map((x) => normalizePlaceName(x.name)),
  );
  const knownRestaurants = grounding.areas.flatMap((a) =>
    a.restaurants.map((x) => normalizePlaceName(x.name)),
  );

  const coverage: GroundingCoverage = {
    pois: { matched: 0, total: 0 },
    restaurants: { matched: 0, total: 0 },
  };

  for (const day of days) {
    for (const slot of [day.morning, day.afternoon, day.evening]) {
      if (!slot) continue;
      coverage.pois.total++;
      const title = normalizePlaceName(slot.title);
      if (knownAttractions.some((k) => namesMatch(title, k))) {
        coverage.pois.matched++;
      }
    }
    for (const restaurant of day.restaurants ?? []) {
      coverage.restaurants.total++;
      const name = normalizePlaceName(restaurant.name);
      if (knownRestaurants.some((k) => namesMatch(name, k))) {
        coverage.restaurants.matched++;
      }
    }
  }
  return coverage;
}
