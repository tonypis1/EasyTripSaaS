/**
 * Converte punteggio 1–10 in etichetta leggibile (come nelle specifiche prodotto).
 */
export function formatGeoScoreLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  const s = Math.round(score * 10) / 10;
  const stars = Math.min(5, Math.max(1, Math.round(s / 2)));
  const bar = "★".repeat(stars) + "☆".repeat(5 - stars);
  return `${bar} (${s}/10)`;
}
