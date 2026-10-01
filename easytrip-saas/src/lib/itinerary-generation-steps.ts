/** Chiavi i18n sotto `app.trips.detail.generating.steps.*` */
export const ITINERARY_GENERATION_STEP_KEYS = [
  "analyzeDestination",
  "optimizeRoutes",
  "findLocalGems",
  "pickRestaurants",
  "organizeDays",
  "finalTouches",
] as const;

export type ItineraryGenerationStepKey =
  (typeof ITINERARY_GENERATION_STEP_KEYS)[number];

/** Durata di ogni messaggio dinamico (ms). */
export const ITINERARY_GENERATION_STEP_MS = 4500;

/** Progresso massimo stimato finché l'itinerario non è pronto (%). */
export const ITINERARY_GENERATION_PROGRESS_CAP = 92;

/**
 * Durata stimata della generazione: grounding + ~50 s per giorno (misurato con
 * l'API reale: ~2,5 minuti per 3 giorni; i viaggi lunghi vanno a blocchi di
 * al massimo 4 giorni, in sequenza).
 */
export function estimateItineraryGenerationMs(numDays: number): number {
  const days = Number.isFinite(numDays) && numDays > 0 ? numDays : 3;
  return 45_000 + days * 50_000;
}

/** Durata stimata in minuti interi, per i testi. */
export function estimateItineraryGenerationMinutes(numDays: number): number {
  return Math.max(
    1,
    Math.round(estimateItineraryGenerationMs(numDays) / 60_000),
  );
}

/**
 * Curva esponenziale verso il tetto: ~84% alla durata stimata, poi rallenta
 * senza mai arrivare al 100% finché l'itinerario non è pronto.
 */
export function estimateItineraryGenerationProgress(
  elapsedMs: number,
  expectedMs: number,
): number {
  const cap = ITINERARY_GENERATION_PROGRESS_CAP;
  const eased = cap * (1 - Math.exp((-2.5 * elapsedMs) / expectedMs));
  return Math.min(cap, Math.round(eased));
}
