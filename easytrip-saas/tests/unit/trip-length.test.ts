import { describe, expect, it } from "vitest";
import {
  GENERATION_CHUNK_DAYS,
  generationChunks,
} from "@/lib/trip/generation-chunks";
import {
  estimateItineraryGenerationMinutes,
  estimateItineraryGenerationMs,
  estimateItineraryGenerationProgress,
  ITINERARY_GENERATION_PROGRESS_CAP,
} from "@/lib/itinerary-generation-steps";
import {
  MAX_TRIP_DAYS,
  maxTripEndIso,
  tripLengthDaysFromIso,
} from "@/lib/trip/trip-limits";

const sizes = (numDays: number) =>
  generationChunks(numDays).map((c) => c.lastDay - c.firstDay + 1);

describe("generationChunks — blocchi della generazione", () => {
  it("viaggi corti: un solo blocco con tutti i giorni", () => {
    expect(generationChunks(1)).toEqual([{ firstDay: 1, lastDay: 1 }]);
    expect(generationChunks(4)).toEqual([{ firstDay: 1, lastDay: 4 }]);
  });

  it("blocchi bilanciati, mai oltre 4 giorni", () => {
    expect(sizes(5)).toEqual([3, 2]);
    expect(sizes(9)).toEqual([3, 3, 3]);
    expect(sizes(10)).toEqual([4, 3, 3]);
    expect(sizes(30)).toEqual([4, 4, 4, 4, 4, 4, 3, 3]);
  });

  it("copre ogni giorno una sola volta, in ordine, per ogni durata ammessa", () => {
    for (let n = 1; n <= MAX_TRIP_DAYS; n++) {
      const chunks = generationChunks(n);
      expect(chunks).toHaveLength(Math.ceil(n / GENERATION_CHUNK_DAYS));
      let next = 1;
      for (const c of chunks) {
        expect(c.firstDay).toBe(next);
        expect(c.lastDay - c.firstDay + 1).toBeLessThanOrEqual(
          GENERATION_CHUNK_DAYS,
        );
        next = c.lastDay + 1;
      }
      expect(next).toBe(n + 1);
    }
  });

  it("rifiuta durate non valide", () => {
    expect(() => generationChunks(0)).toThrow(RangeError);
    expect(() => generationChunks(2.5)).toThrow(RangeError);
  });
});

describe("durata massima del viaggio", () => {
  it("conta i giorni di calendario, estremi inclusi", () => {
    expect(tripLengthDaysFromIso("2026-06-01", "2026-06-01")).toBe(1);
    expect(tripLengthDaysFromIso("2026-06-01", "2026-06-30")).toBe(30);
    expect(tripLengthDaysFromIso("2026-03-28", "2026-03-30")).toBe(3); // cambio ora legale
    expect(tripLengthDaysFromIso("", "2026-06-30")).toBeNull();
    expect(tripLengthDaysFromIso("2026-13-45", "2026-06-30")).toBeNull();
  });

  it("ultima data di fine ammessa: inizio + 29 giorni", () => {
    expect(MAX_TRIP_DAYS).toBe(30);
    expect(maxTripEndIso("2026-06-01")).toBe("2026-06-30");
    expect(maxTripEndIso("2026-02-15")).toBe("2026-03-16");
    expect(maxTripEndIso("")).toBeNull();
  });
});

describe("attesa della generazione", () => {
  it("la durata stimata cresce con i giorni del viaggio", () => {
    expect(estimateItineraryGenerationMinutes(3)).toBe(3);
    expect(estimateItineraryGenerationMinutes(10)).toBe(9);
    expect(estimateItineraryGenerationMinutes(MAX_TRIP_DAYS)).toBe(26);
    // Durata sconosciuta: stima di un viaggio breve.
    expect(estimateItineraryGenerationMs(Number.NaN)).toBe(
      estimateItineraryGenerationMs(3),
    );
  });

  it("il progresso arriva a ~84% alla durata stimata e non supera mai il tetto", () => {
    const expected = estimateItineraryGenerationMs(10);
    expect(estimateItineraryGenerationProgress(0, expected)).toBe(0);
    expect(estimateItineraryGenerationProgress(expected, expected)).toBe(84);
    expect(estimateItineraryGenerationProgress(expected * 10, expected)).toBe(
      ITINERARY_GENERATION_PROGRESS_CAP,
    );
    // Un viaggio lungo avanza più lentamente di uno corto.
    expect(
      estimateItineraryGenerationProgress(
        60_000,
        estimateItineraryGenerationMs(30),
      ),
    ).toBeLessThan(
      estimateItineraryGenerationProgress(
        60_000,
        estimateItineraryGenerationMs(3),
      ),
    );
  });
});
