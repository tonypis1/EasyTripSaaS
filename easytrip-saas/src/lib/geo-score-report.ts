/**
 * Confronto tra il GeoScore salvato (dichiarato dal modello per le versioni
 * generate prima del calcolo indipendente) e quello calcolato dalle
 * coordinate. Pure: l'I/O sta in `scripts/geo-score-report.ts`.
 */

export type GeoScoreComparisonRow = {
  versionId: string;
  stored: number | null;
  computed: number | null;
};

export type GeoScoreDelta = {
  versionId: string;
  stored: number;
  computed: number;
  /** computed − stored: negativo = il modello era troppo ottimista. */
  delta: number;
};

export type GeoScoreComparison = {
  versions: number;
  /** Versioni con punteggio sia salvato sia calcolabile: base del confronto. */
  comparable: number;
  /** Versioni le cui coordinate non bastano per calcolare un punteggio. */
  unscorable: number;
  meanStored: number | null;
  meanComputed: number | null;
  meanDelta: number | null;
  meanAbsDelta: number | null;
  /** Il salvato supera il calcolato di almeno 1 punto (modello ottimista). */
  declaredTooHigh: number;
  /** Il calcolato supera il salvato di almeno 1 punto. */
  declaredTooLow: number;
  /** Differenza entro ±1 punto. */
  withinOne: number;
  /** Le divergenze più grandi (per valore assoluto), da ispezionare a mano. */
  largest: GeoScoreDelta[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) =>
  xs.length === 0 ? null : round2(xs.reduce((a, b) => a + b, 0) / xs.length);

export function compareGeoScores(
  rows: readonly GeoScoreComparisonRow[],
  topN = 10,
): GeoScoreComparison {
  const comparable: GeoScoreDelta[] = [];
  for (const row of rows) {
    if (row.stored != null && row.computed != null) {
      comparable.push({
        versionId: row.versionId,
        stored: row.stored,
        computed: row.computed,
        delta: round2(row.computed - row.stored),
      });
    }
  }

  return {
    versions: rows.length,
    comparable: comparable.length,
    unscorable: rows.filter((r) => r.computed == null).length,
    meanStored: mean(comparable.map((c) => c.stored)),
    meanComputed: mean(comparable.map((c) => c.computed)),
    meanDelta: mean(comparable.map((c) => c.delta)),
    meanAbsDelta: mean(comparable.map((c) => Math.abs(c.delta))),
    declaredTooHigh: comparable.filter((c) => c.delta <= -1).length,
    declaredTooLow: comparable.filter((c) => c.delta >= 1).length,
    withinOne: comparable.filter((c) => Math.abs(c.delta) < 1).length,
    largest: [...comparable]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, topN),
  };
}
