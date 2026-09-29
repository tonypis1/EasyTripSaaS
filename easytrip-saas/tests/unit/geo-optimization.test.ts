import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/haversine-walk-estimate";
import {
  FAR_LEG_KM,
  MIN_SCORED_DAYS_RATIO,
  analyzeDay,
  analyzeItineraryGeo,
  bestVisitOrder,
  geoInputFromStoredDay,
  resolveGeoScore,
  scoreDayRoute,
  toGeoPoint,
  type DayGeoInput,
} from "@/lib/geo-optimization";

// Luoghi reali (WGS84) per casi geografici noti.
const ROME = {
  colosseo: { lat: 41.8902, lng: 12.4922 },
  foro: { lat: 41.8925, lng: 12.4853 },
  pantheon: { lat: 41.8986, lng: 12.4769 },
  vaticano: { lat: 41.9065, lng: 12.4536 },
};
const PARIS = {
  eiffel: { lat: 48.8584, lng: 2.2945 },
  versailles: { lat: 48.8049, lng: 2.1204 },
  sacreCoeur: { lat: 48.8867, lng: 2.3431 },
};

function day(
  dayNumber: number,
  morning: unknown,
  afternoon: unknown,
  evening: unknown,
): DayGeoInput {
  return {
    dayNumber,
    morning: morning as DayGeoInput["morning"],
    afternoon: afternoon as DayGeoInput["afternoon"],
    evening: evening as DayGeoInput["evening"],
  };
}

const linearDay = day(1, ROME.colosseo, ROME.foro, ROME.pantheon);
const zigzagDay = day(2, ROME.colosseo, ROME.vaticano, ROME.foro);
const scatteredDay = day(3, PARIS.eiffel, PARIS.versailles, PARIS.sacreCoeur);

describe("toGeoPoint", () => {
  it("accetta coordinate valide", () => {
    expect(toGeoPoint(ROME.colosseo)).toEqual(ROME.colosseo);
  });

  it.each([
    ["mancante", null],
    ["senza coordinate", {}],
    ["stringhe", { lat: "41.9", lng: "12.4" }],
    ["NaN", { lat: Number.NaN, lng: 12.4 }],
    ["Infinity", { lat: 41.9, lng: Number.POSITIVE_INFINITY }],
    ["latitudine fuori range", { lat: 91, lng: 12.4 }],
    ["longitudine fuori range", { lat: 41.9, lng: 181 }],
    ["segnaposto (0, 0)", { lat: 0, lng: 0 }],
  ])("scarta coordinate non utilizzabili: %s", (_label, slot) => {
    expect(toGeoPoint(slot as never)).toBeNull();
  });

  it("non scarta un luogo reale sull'equatore o sul meridiano zero", () => {
    expect(toGeoPoint({ lat: 0, lng: 36.8 })).not.toBeNull(); // Nairobi
    expect(toGeoPoint({ lat: 51.5, lng: 0 })).not.toBeNull(); // Greenwich
  });
});

describe("bestVisitOrder", () => {
  it("trova l'ordine più corto di tappe in fila su una retta", () => {
    // Su una retta: 0 km, 10 km, 1 km → conviene 0 → 1 → 10.
    const points = [
      { lat: 10, lng: 10 },
      { lat: 10.09, lng: 10 },
      { lat: 10.009, lng: 10 },
    ];
    const { order } = bestVisitOrder(points);
    expect(order).toEqual([0, 2, 1]);
  });

  it("coincide con il minimo ottenuto enumerando a mano tutti gli ordini (4 tappe)", () => {
    const points = [ROME.colosseo, ROME.vaticano, ROME.foro, ROME.pantheon];

    const allOrders = (items: number[]): number[][] =>
      items.length <= 1
        ? [items]
        : items.flatMap((x, i) =>
            allOrders([...items.slice(0, i), ...items.slice(i + 1)]).map(
              (rest) => [x, ...rest],
            ),
          );
    const length = (order: number[]) =>
      order
        .slice(1)
        .reduce(
          (sum, idx, i) => sum + haversineKm(points[order[i]], points[idx]),
          0,
        );
    const expected = Math.min(...allOrders([0, 1, 2, 3]).map(length));

    const best = bestVisitOrder(points);
    expect(best.lengthKm).toBeCloseTo(expected, 9);
    expect(length(best.order)).toBeCloseTo(expected, 9);
    // Non è l'ordine di partenza (zig-zag): quello è strettamente più lungo.
    expect(length([0, 1, 2, 3])).toBeGreaterThan(expected + 1);
  });

  it("a parità di lunghezza mantiene l'ordine originale", () => {
    const a = { lat: 41.9, lng: 12.5 };
    const b = { lat: 41.91, lng: 12.5 };
    expect(bestVisitOrder([a, b]).order).toEqual([0, 1]);
  });

  it("gestisce insiemi vuoti e singoli", () => {
    expect(bestVisitOrder([])).toEqual({ order: [], lengthKm: 0 });
    expect(bestVisitOrder([ROME.foro])).toEqual({ order: [0], lengthKm: 0 });
  });

  it("rifiuta più di 8 punti (ricerca esatta O(n!))", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      lat: 41 + i * 0.01,
      lng: 12,
    }));
    expect(() => bestVisitOrder(many)).toThrow(RangeError);
  });
});

describe("analyzeDay", () => {
  it("percorso lineare: nessun km evitabile e punteggio pieno", () => {
    const r = analyzeDay(linearDay);

    expect(r.scored).toBe(true);
    expect(r.visited).toEqual(["morning", "afternoon", "evening"]);
    expect(r.bestOrder).toEqual(["morning", "afternoon", "evening"]);
    expect(r.avoidableKm).toBe(0);
    expect(r.isOrderImprovable).toBe(false);
    expect(r.routeKm).toBeGreaterThan(1.5);
    expect(r.routeKm).toBeLessThan(2.5);
    expect(r.score).toBeGreaterThanOrEqual(9.5);
  });

  it("zig-zag Colosseo → Vaticano → Foro: individua il riordino e i km risparmiabili", () => {
    const r = analyzeDay(zigzagDay);

    // Colosseo → Foro (0.63 km) → Vaticano (3.05 km) = 3.68 km invece di attraversare
    // la città due volte (Colosseo → Vaticano → Foro = 6.72 km). Valori verificati
    // indipendentemente con la formula di Haversine.
    expect(r.bestOrder).toEqual(["morning", "evening", "afternoon"]);
    expect(r.routeKm).toBeCloseTo(6.72, 1);
    expect(r.optimalKm).toBeCloseTo(3.68, 1);
    expect(r.avoidableKm).toBeCloseTo(3.05, 1);
    expect(r.isOrderImprovable).toBe(true);
    expect(r.score).toBeLessThan(analyzeDay(linearDay).score ?? 0);
  });

  it("stesse tappe, ordine diverso: il punteggio premia quello efficiente", () => {
    const efficient = analyzeDay(
      day(1, ROME.colosseo, ROME.foro, ROME.vaticano),
    );
    const zigzag = analyzeDay(day(1, ROME.colosseo, ROME.vaticano, ROME.foro));

    expect(efficient.avoidableKm).toBe(0);
    expect(efficient.score ?? 0).toBeGreaterThan(zigzag.score ?? 99);
  });

  it("giorno con tappe distantissime (Versailles/Eiffel/Montmartre) ottiene un punteggio basso", () => {
    const r = analyzeDay(scatteredDay);

    expect(r.longestLegKm).toBeGreaterThan(FAR_LEG_KM);
    expect(r.score).toBeLessThan(4);
    expect(r.isOrderImprovable).toBe(true);
    expect(r.bestOrder).toEqual(["afternoon", "morning", "evening"]);
  });

  it("due tappe con coordinate: una sola tratta, niente riordino possibile", () => {
    const r = analyzeDay(day(1, ROME.colosseo, null, ROME.pantheon));

    expect(r.scored).toBe(true);
    expect(r.visited).toEqual(["morning", "evening"]);
    expect(r.avoidableKm).toBe(0);
    expect(r.bestOrder).toEqual(["morning", "evening"]);
  });

  it("meno di due tappe con coordinate: giorno non valutato", () => {
    expect(analyzeDay(day(1, ROME.colosseo, null, null))).toMatchObject({
      scored: false,
      unscoredReason: "insufficient_points",
      score: null,
    });
    expect(
      analyzeDay(day(1, { lat: 0, lng: 0 }, { lat: 200, lng: 0 }, {})),
    ).toMatchObject({ scored: false, unscoredReason: "insufficient_points" });
  });

  it("coordinate identiche in tutte le tappe non valgono un punteggio perfetto", () => {
    const same = { lat: 41.9029, lng: 12.4534 }; // centro città copiato ovunque
    const r = analyzeDay(day(1, same, same, same));

    expect(r).toMatchObject({
      scored: false,
      unscoredReason: "identical_points",
      score: null,
    });
  });

  it("due tappe coincidenti e una distinta: il giorno resta valutato", () => {
    const r = analyzeDay(day(1, ROME.colosseo, ROME.colosseo, ROME.pantheon));
    expect(r.scored).toBe(true);
  });

  it("stima a piedi coerente col percorso (~5 km/h)", () => {
    const r = analyzeDay(linearDay);
    expect(r.walkMinutes).toBeGreaterThanOrEqual(
      Math.round((r.routeKm / 5) * 60) - 1,
    );
    expect(r.walkMinutes).toBeLessThanOrEqual(
      Math.round((r.routeKm / 5) * 60) + 1,
    );
  });
});

describe("scoreDayRoute", () => {
  it("limiti della scala: 10 per un giorno compatto ed efficiente, 1 per il peggiore", () => {
    expect(scoreDayRoute({ routeKm: 0.8, avoidableKm: 0, legs: 2 })).toBe(10);
    expect(scoreDayRoute({ routeKm: 60, avoidableKm: 60, legs: 2 })).toBe(1);
  });

  it("è monotono: più km medi o più km evitabili abbassano il punteggio", () => {
    const base = scoreDayRoute({ routeKm: 4, avoidableKm: 0, legs: 2 });
    const longer = scoreDayRoute({ routeKm: 12, avoidableKm: 0, legs: 2 });
    const wasteful = scoreDayRoute({ routeKm: 4, avoidableKm: 2, legs: 2 });

    expect(longer).toBeLessThan(base);
    expect(wasteful).toBeLessThan(base);
  });

  it("non penalizza differenze di poche centinaia di metri in un giorno a piedi", () => {
    expect(
      scoreDayRoute({ routeKm: 0.6, avoidableKm: 0.2, legs: 2 }),
    ).toBeGreaterThan(9);
  });
});

describe("analyzeItineraryGeo", () => {
  it("media i giorni valutati e somma km totali ed evitabili", () => {
    const r = analyzeItineraryGeo([linearDay, zigzagDay]);
    const [a, b] = r.days;

    expect(r.scoredDays).toBe(2);
    expect(r.totalDays).toBe(2);
    expect(r.score).toBe(
      Math.round((((a.score ?? 0) + (b.score ?? 0)) / 2) * 10) / 10,
    );
    expect(r.totalKm).toBeCloseTo(a.routeKm + b.routeKm, 1);
    expect(r.avoidableKm).toBeCloseTo(a.avoidableKm + b.avoidableKm, 1);
  });

  it("un itinerario ben ordinato batte uno a zig-zag, e questo uno sparpagliato", () => {
    const good = analyzeItineraryGeo([linearDay]).score ?? 0;
    const zigzag = analyzeItineraryGeo([zigzagDay]).score ?? 0;
    const scattered = analyzeItineraryGeo([scatteredDay]).score ?? 0;

    expect(good).toBeGreaterThan(zigzag);
    expect(zigzag).toBeGreaterThan(scattered);
  });

  it("senza abbastanza giorni valutabili il punteggio è null (troppo poco per fidarsi)", () => {
    const empty = day(9, null, null, null);
    // 1 giorno valutato su 3 = 33% < soglia.
    const r = analyzeItineraryGeo([linearDay, empty, empty]);

    expect(1 / 3).toBeLessThan(MIN_SCORED_DAYS_RATIO);
    expect(r.scoredDays).toBe(1);
    expect(r.score).toBeNull();
  });

  it("2 giorni su 3 valutati bastano", () => {
    const empty = day(9, null, null, null);
    expect(
      analyzeItineraryGeo([linearDay, zigzagDay, empty]).score,
    ).not.toBeNull();
  });

  it("nessun giorno: nessun punteggio, nessuna divisione per zero", () => {
    expect(analyzeItineraryGeo([])).toMatchObject({
      score: null,
      scoredDays: 0,
      totalDays: 0,
      totalKm: 0,
    });
  });

  it("il punteggio sta sempre in scala 1–10 con una cifra decimale", () => {
    for (const d of [linearDay, zigzagDay, scatteredDay]) {
      const s = analyzeItineraryGeo([d]).score ?? 0;
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(10);
      expect(s).toBe(Math.round(s * 10) / 10);
    }
  });
});

describe("resolveGeoScore", () => {
  const good = analyzeItineraryGeo([linearDay]);
  const unusable = analyzeItineraryGeo([day(1, null, null, null)]);

  it("preferisce il punteggio calcolato a quello dichiarato dal modello", () => {
    expect(resolveGeoScore(good, 6.5)).toEqual({
      score: good.score,
      source: "computed",
    });
  });

  it("ripiega sul dichiarato se le coordinate non bastano", () => {
    expect(resolveGeoScore(unusable, 8)).toEqual({
      score: 8,
      source: "declared",
    });
  });

  it("senza né l'uno né l'altro non inventa un punteggio", () => {
    expect(resolveGeoScore(unusable, null)).toEqual({
      score: null,
      source: "none",
    });
  });
});

describe("geoInputFromStoredDay", () => {
  it("legge le coordinate dagli slot salvati come JSON", () => {
    const input = geoInputFromStoredDay({
      dayNumber: 1,
      morning: JSON.stringify({ title: "Colosseo", ...ROME.colosseo }),
      afternoon: JSON.stringify({ title: "Foro", ...ROME.foro }),
      evening: JSON.stringify({ title: "Pantheon", ...ROME.pantheon }),
    });

    expect(analyzeDay(input)).toEqual(analyzeDay(linearDay));
  });

  it.each([
    ["null", null],
    ["stringa vuota", ""],
    ["JSON non valido", "{non json"],
    ["valore non oggetto", "42"],
    ["null JSON", "null"],
  ])("tollera slot illeggibili: %s", (_label, raw) => {
    const input = geoInputFromStoredDay({
      dayNumber: 1,
      morning: raw,
      afternoon: raw,
      evening: raw,
    });

    expect(analyzeDay(input)).toMatchObject({
      scored: false,
      unscoredReason: "insufficient_points",
    });
  });
});
