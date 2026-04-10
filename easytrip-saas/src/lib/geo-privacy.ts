/**
 * Riduce la precisione delle coordinate prima dell’invio a servizi AI terzi
 * (Privacy by Design — minimizzazione; ~100 m con 3 decimali).
 */
export const AI_LOCATION_DECIMALS = 3;

export function roundCoordForAi(value: number): number {
  const f = 10 ** AI_LOCATION_DECIMALS;
  return Math.round(value * f) / f;
}
