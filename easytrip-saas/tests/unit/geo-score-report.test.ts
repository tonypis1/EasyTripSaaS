import { describe, expect, it } from "vitest";
import { compareGeoScores } from "@/lib/geo-score-report";

const row = (
  versionId: string,
  stored: number | null,
  computed: number | null,
) => ({
  versionId,
  stored,
  computed,
});

describe("compareGeoScores", () => {
  it("nessuna versione: contatori a zero e medie null (niente divisioni per zero)", () => {
    expect(compareGeoScores([])).toEqual({
      versions: 0,
      comparable: 0,
      unscorable: 0,
      meanStored: null,
      meanComputed: null,
      meanDelta: null,
      meanAbsDelta: null,
      declaredTooHigh: 0,
      declaredTooLow: 0,
      withinOne: 0,
      largest: [],
    });
  });

  it("calcola medie e scarto (calcolato − dichiarato) sulle sole versioni confrontabili", () => {
    const r = compareGeoScores([
      row("a", 9, 7), // −2: il modello era ottimista
      row("b", 8, 8.5), // +0.5
      row("c", 6, 9), // +3
      row("d", 7, null), // coordinate insufficienti
      row("e", null, 8), // niente salvato: non confrontabile
    ]);

    expect(r.versions).toBe(5);
    expect(r.comparable).toBe(3);
    expect(r.unscorable).toBe(1);
    expect(r.meanStored).toBe(7.67);
    expect(r.meanComputed).toBe(8.17);
    expect(r.meanDelta).toBe(0.5);
    expect(r.meanAbsDelta).toBe(1.83);
  });

  it("classifica le divergenze: troppo alto / troppo basso / entro ±1", () => {
    const r = compareGeoScores([
      row("high", 9.5, 6), // −3.5
      row("edge-high", 8, 7), // −1 esatto: conta come troppo alto
      row("close", 8, 8.9), // +0.9
      row("low", 5, 8), // +3
    ]);

    expect(r.declaredTooHigh).toBe(2);
    expect(r.declaredTooLow).toBe(1);
    expect(r.withinOne).toBe(1);
    expect(r.declaredTooHigh + r.declaredTooLow + r.withinOne).toBe(
      r.comparable,
    );
  });

  it("elenca le divergenze maggiori per valore assoluto, limitate a topN", () => {
    const r = compareGeoScores(
      [row("a", 5, 5.5), row("b", 9, 4), row("c", 3, 8), row("d", 7, 6)],
      2,
    );

    expect(r.largest.map((l) => l.versionId)).toEqual(["b", "c"]);
    expect(r.largest[0]).toEqual({
      versionId: "b",
      stored: 9,
      computed: 4,
      delta: -5,
    });
  });

  it("non modifica l'array in ingresso", () => {
    const rows = [row("a", 5, 9), row("b", 9, 5), row("c", 7, 7)];
    const copy = rows.map((r) => ({ ...r }));

    compareGeoScores(rows);

    expect(rows).toEqual(copy);
  });
});
