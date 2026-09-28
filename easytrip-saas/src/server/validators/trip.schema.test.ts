import { describe, expect, it } from "vitest";
import {
  createTripSchema,
  liveSuggestSchema,
  replaceSlotSchema,
  setActiveVersionSchema,
  updatePreferencesSchema,
} from "./trip.schema";

describe("createTripSchema", () => {
  it("accetta payload valido", () => {
    const parsed = createTripSchema.parse({
      destination: "Lisbona",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      tripType: "coppia",
      budgetLevel: "moderate",
    });
    expect(parsed.destination).toBe("Lisbona");
    expect(parsed.tripType).toBe("coppia");
  });

  it("rifiuta destinazione troppo corta", () => {
    expect(() =>
      createTripSchema.parse({
        destination: "X",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        tripType: "solo",
      }),
    ).toThrow();
  });
});

describe("setActiveVersionSchema", () => {
  it("accetta versionNum nel range 1-7", () => {
    expect(setActiveVersionSchema.parse({ versionNum: 3 }).versionNum).toBe(3);
  });

  it("rifiuta versionNum fuori range", () => {
    expect(() => setActiveVersionSchema.parse({ versionNum: 8 })).toThrow();
  });
});

describe("replaceSlotSchema", () => {
  it("richiede dayId e slot", () => {
    const r = replaceSlotSchema.parse({
      dayId: "day_1",
      slot: "morning",
    });
    expect(r.slot).toBe("morning");
  });
});

describe("liveSuggestSchema", () => {
  it("accetta coordinate, motivo e ora locale del dispositivo", () => {
    const r = liveSuggestSchema.parse({
      dayId: "day_1",
      lat: 45.4,
      lng: 9.18,
      reason: "weather",
      localHour: 21,
    });
    expect(r.reason).toBe("weather");
    expect(r.localHour).toBe(21);
  });

  it("rifiuta localHour fuori dal range 0-23", () => {
    expect(() =>
      liveSuggestSchema.parse({
        dayId: "day_1",
        lat: 45.4,
        lng: 9.18,
        localHour: 24,
      }),
    ).toThrow();
  });
});

describe("updatePreferencesSchema", () => {
  it("aggiorna solo budgetLevel", () => {
    const r = updatePreferencesSchema.parse({
      budgetLevel: "premium",
    });
    expect(r.budgetLevel).toBe("premium");
  });
});
