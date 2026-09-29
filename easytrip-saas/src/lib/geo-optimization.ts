import {
  haversineKm,
  walkMinutesEstimateKm,
} from "@/lib/haversine-walk-estimate";
import { SLOT_KEYS, type SlotKey } from "@/lib/slot-vote";
import { readStoredSlot } from "@/lib/trip/day-slots";

/**
 * Analisi geografica indipendente dell'itinerario.
 *
 * Il modello dichiara un `optimizationScore` che nessuno verifica; qui il
 * punteggio si calcola dalle coordinate delle tappe (formula di Haversine),
 * così vale lo stesso per un itinerario appena generato e per uno modificato
 * a mano con una sostituzione di slot.
 *
 * Per ogni giorno si confronta il percorso effettivo (mattina → pomeriggio →
 * sera) con l'ordine migliore possibile delle stesse tappe. Con al più 3 tappe
 * al giorno la ricerca esaustiva è esatta ed è più semplice di un'euristica
 * (nearest-neighbor/2-opt servirebbero solo oltre ~9 punti).
 *
 * Limiti noti: le distanze sono in linea d'aria (non seguono le strade) e la
 * scala del punteggio è tarata su spostamenti cittadini; un giorno di
 * escursione in auto tra borghi distanti viene penalizzato anche se sensato.
 */

export type GeoPoint = { lat: number; lng: number };

/** Tappa con coordinate: accetta sia lo slot generato sia il JSON salvato già parsato. */
export type GeoSlotLike = { lat?: unknown; lng?: unknown } | null | undefined;

export type DayGeoInput = { dayNumber: number } & Partial<
  Record<SlotKey, GeoSlotLike>
>;

/** Distanza media tra tappe consecutive entro cui ci si sposta a piedi senza pensieri (punteggio pieno). */
export const WALKABLE_LEG_KM = 1;
/** Distanza media tra tappe consecutive oltre cui la compattezza del giorno vale zero. */
export const FAR_LEG_KM = 15;
export const COMPACTNESS_WEIGHT = 0.65;
export const ORDER_WEIGHT = 0.35;
/** Frazione minima di giorni valutabili perché il punteggio dell'intero viaggio sia attendibile. */
export const MIN_SCORED_DAYS_RATIO = 0.5;
/** Un riordino viene suggerito solo se fa risparmiare almeno questi km… */
export const IMPROVABLE_MIN_SAVING_KM = 1.5;
/** …e almeno questa quota del percorso del giorno (evita suggerimenti su differenze trascurabili). */
export const IMPROVABLE_MIN_SAVING_RATIO = 0.25;
/** Tutte le tappe di un giorno entro questa distanza = coordinate duplicate/segnaposto, non verificabili. */
export const SAME_POINT_KM = 0.05;

const MAX_EXACT_POINTS = 8;
const EPS = 1e-9;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type UnscoredReason = "insufficient_points" | "identical_points";

export type DayGeoAnalysis = {
  dayNumber: number;
  /** false se il giorno non entra nel punteggio (vedi `unscoredReason`). */
  scored: boolean;
  unscoredReason: UnscoredReason | null;
  /** Slot con coordinate valide, in ordine cronologico. */
  visited: SlotKey[];
  routeKm: number;
  /** Lunghezza del miglior ordine possibile delle stesse tappe. */
  optimalKm: number;
  /** Km risparmiabili riordinando le tappe (mai negativo). */
  avoidableKm: number;
  longestLegKm: number;
  /** Stima a piedi (~5 km/h) dell'intero percorso del giorno. */
  walkMinutes: number;
  /** Ordine più efficiente delle stesse tappe (uguale a `visited` se già ottimale). */
  bestOrder: SlotKey[];
  /** true se il riordino risparmia abbastanza da valere un suggerimento. */
  isOrderImprovable: boolean;
  /** 1–10, null se il giorno non è valutabile. */
  score: number | null;
};

export type ItineraryGeoAnalysis = {
  /** 1–10 (una cifra decimale); null se i giorni valutabili sono troppo pochi. */
  score: number | null;
  totalKm: number;
  avoidableKm: number;
  scoredDays: number;
  totalDays: number;
  days: DayGeoAnalysis[];
};

/** Coordinate valide di una tappa, o null (mancanti, non numeriche, fuori range, segnaposto 0,0). */
export function toGeoPoint(slot: GeoSlotLike): GeoPoint | null {
  if (!slot) return null;
  const { lat, lng } = slot;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // (0, 0) è il valore tipico di coordinate mancanti, non un luogo in cui pianificare un viaggio.
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return null;
  return { lat, lng };
}

function pathLengthKm(points: readonly GeoPoint[], order: readonly number[]) {
  let total = 0;
  for (let i = 1; i < order.length; i++) {
    total += haversineKm(points[order[i - 1]], points[order[i]]);
  }
  return total;
}

function* permutations(n: number): Generator<number[]> {
  const items = Array.from({ length: n }, (_, i) => i);
  function* recurse(prefix: number[], rest: number[]): Generator<number[]> {
    if (rest.length === 0) {
      yield prefix;
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      yield* recurse(
        [...prefix, rest[i]],
        [...rest.slice(0, i), ...rest.slice(i + 1)],
      );
    }
  }
  yield* recurse([], items);
}

/**
 * Ordine di visita più corto (percorso aperto, senza vincoli sul punto di
 * partenza) di un piccolo insieme di tappe. Ricerca esatta, O(n!): il limite
 * a 8 punti è un guardrail, l'uso reale è al massimo 3. A parità di lunghezza
 * resta l'ordine originale.
 */
export function bestVisitOrder(points: readonly GeoPoint[]): {
  order: number[];
  lengthKm: number;
} {
  if (points.length > MAX_EXACT_POINTS) {
    throw new RangeError(
      `bestVisitOrder: massimo ${MAX_EXACT_POINTS} punti (ricerca esatta), ricevuti ${points.length}`,
    );
  }

  let bestOrder = points.map((_, i) => i);
  let bestLength = pathLengthKm(points, bestOrder);
  for (const candidate of permutations(points.length)) {
    const length = pathLengthKm(points, candidate);
    if (length < bestLength - EPS) {
      bestLength = length;
      bestOrder = candidate;
    }
  }
  return { order: bestOrder, lengthKm: bestLength };
}

/**
 * Punteggio 1–10 di un giorno: 65% compattezza (distanza media tra tappe
 * consecutive: ≤ 1 km = pieno, ≥ 15 km = zero) + 35% efficienza dell'ordine
 * (quota di percorso evitabile riordinando; il denominatore minimo di 1 km
 * evita di penalizzare differenze di poche centinaia di metri).
 */
export function scoreDayRoute(params: {
  routeKm: number;
  avoidableKm: number;
  legs: number;
}): number {
  const avgLegKm = params.routeKm / Math.max(1, params.legs);
  const compactness = clamp01(
    (FAR_LEG_KM - avgLegKm) / (FAR_LEG_KM - WALKABLE_LEG_KM),
  );
  const orderEfficiency =
    1 - Math.min(1, params.avoidableKm / Math.max(params.routeKm, 1));
  const unit =
    COMPACTNESS_WEIGHT * compactness + ORDER_WEIGHT * orderEfficiency;
  return round1(1 + 9 * unit);
}

function unscoredDay(
  dayNumber: number,
  visited: SlotKey[],
  reason: UnscoredReason,
  routeKm = 0,
): DayGeoAnalysis {
  return {
    dayNumber,
    scored: false,
    unscoredReason: reason,
    visited,
    routeKm,
    optimalKm: routeKm,
    avoidableKm: 0,
    longestLegKm: 0,
    walkMinutes: 0,
    bestOrder: visited,
    isOrderImprovable: false,
    score: null,
  };
}

export function analyzeDay(input: DayGeoInput): DayGeoAnalysis {
  const stops = SLOT_KEYS.flatMap((key) => {
    const point = toGeoPoint(input[key]);
    return point ? [{ key, point }] : [];
  });
  const visited = stops.map((s) => s.key);
  const points = stops.map((s) => s.point);

  if (points.length < 2) {
    return unscoredDay(input.dayNumber, visited, "insufficient_points");
  }

  const identity = points.map((_, i) => i);
  const routeKm = pathLengthKm(points, identity);
  const legs = points.slice(1).map((p, i) => haversineKm(points[i], p));

  // Tutte le tappe nello stesso punto: quasi certamente coordinate copiate/segnaposto,
  // non un giorno perfettamente compatto. Meglio non valutarlo che premiarlo.
  const farthest = Math.max(
    ...points.flatMap((a, i) =>
      points.slice(i + 1).map((b) => haversineKm(a, b)),
    ),
  );
  if (farthest < SAME_POINT_KM) {
    return unscoredDay(input.dayNumber, visited, "identical_points", routeKm);
  }

  const best = bestVisitOrder(points);
  const avoidableKm = Math.max(0, routeKm - best.lengthKm);
  const isOrderImprovable =
    avoidableKm >= IMPROVABLE_MIN_SAVING_KM &&
    avoidableKm / Math.max(routeKm, EPS) >= IMPROVABLE_MIN_SAVING_RATIO;

  return {
    dayNumber: input.dayNumber,
    scored: true,
    unscoredReason: null,
    visited,
    routeKm: round2(routeKm),
    optimalKm: round2(best.lengthKm),
    avoidableKm: round2(avoidableKm),
    longestLegKm: round2(Math.max(...legs)),
    walkMinutes: walkMinutesEstimateKm(routeKm),
    bestOrder: best.order.map((i) => visited[i]),
    isOrderImprovable,
    score: scoreDayRoute({
      routeKm,
      avoidableKm,
      legs: legs.length,
    }),
  };
}

export function analyzeItineraryGeo(
  days: readonly DayGeoInput[],
): ItineraryGeoAnalysis {
  const analyzed = days.map(analyzeDay);
  const scored = analyzed.filter((d) => d.scored && d.score != null);

  const reliable =
    scored.length > 0 &&
    scored.length / analyzed.length >= MIN_SCORED_DAYS_RATIO;
  const mean = scored.reduce((sum, d) => sum + (d.score ?? 0), 0);

  return {
    score: reliable ? round1(mean / scored.length) : null,
    totalKm: round2(scored.reduce((sum, d) => sum + d.routeKm, 0)),
    avoidableKm: round2(scored.reduce((sum, d) => sum + d.avoidableKm, 0)),
    scoredDays: scored.length,
    totalDays: analyzed.length,
    days: analyzed,
  };
}

/**
 * Punteggio da salvare: quello calcolato se attendibile, altrimenti quello
 * dichiarato dal modello (o null se non c'è nemmeno quello).
 */
export function resolveGeoScore(
  analysis: ItineraryGeoAnalysis,
  declared: number | null,
): { score: number | null; source: "computed" | "declared" | "none" } {
  if (analysis.score != null) {
    return { score: analysis.score, source: "computed" };
  }
  if (declared != null) return { score: declared, source: "declared" };
  return { score: null, source: "none" };
}

/** Adattatore per i giorni salvati a DB (slot jsonb, letti in modo tollerante). */
export function geoInputFromStoredDay(day: {
  dayNumber: number;
  morning: unknown;
  afternoon: unknown;
  evening: unknown;
}): DayGeoInput {
  return {
    dayNumber: day.dayNumber,
    morning: readStoredSlot(day.morning),
    afternoon: readStoredSlot(day.afternoon),
    evening: readStoredSlot(day.evening),
  };
}
