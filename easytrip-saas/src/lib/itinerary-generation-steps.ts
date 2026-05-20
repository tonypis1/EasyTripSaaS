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

/** Curva esponenziale: ~92% in ~75–90 s di attesa tipica. */
export const ITINERARY_GENERATION_PROGRESS_HALF_LIFE_MS = 35_000;

export function estimateItineraryGenerationProgress(elapsedMs: number): number {
  const cap = ITINERARY_GENERATION_PROGRESS_CAP;
  const eased =
    cap *
    (1 - Math.exp(-elapsedMs / ITINERARY_GENERATION_PROGRESS_HALF_LIFE_MS));
  return Math.min(cap, Math.round(eased));
}
