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

const validTrip = {
  destination: "Lisbona",
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  tripType: "coppia",
};

describe("createTripSchema — preferenze strutturate", () => {
  it("sono facoltative: senza input si ottengono valori vuoti (i client esistenti continuano a funzionare)", () => {
    const parsed = createTripSchema.parse(validTrip);

    expect(parsed.interests).toEqual([]);
    expect(parsed.pace).toBeNull();
    expect(parsed.mobilityNeeds).toEqual([]);
    expect(parsed.dietaryRestrictions).toEqual([]);
  });

  it("accetta scelte valide, le normalizza (senza duplicati, ordine canonico) e mantiene lo stile libero", () => {
    const parsed = createTripSchema.parse({
      ...validTrip,
      style: "foodie",
      interests: ["wellness", "art_museums", "wellness"],
      pace: "relaxed",
      mobilityNeeds: ["stroller", "limited_walking"],
      dietaryRestrictions: ["gluten_free", "vegetarian"],
    });

    expect(parsed.style).toBe("foodie");
    expect(parsed.interests).toEqual(["art_museums", "wellness"]);
    expect(parsed.pace).toBe("relaxed");
    expect(parsed.mobilityNeeds).toEqual(["limited_walking", "stroller"]);
    expect(parsed.dietaryRestrictions).toEqual(["vegetarian", "gluten_free"]);
  });

  it.each([
    ["interesse sconosciuto", { interests: ["ufo"] }],
    [
      "troppi interessi",
      {
        interests: [
          "art_museums",
          "history",
          "food_wine",
          "nature",
          "architecture",
          "nightlife",
          "shopping",
        ],
      },
    ],
    ["ritmo non valido", { pace: "veloce" }],
    ["mobilità sconosciuta", { mobilityNeeds: ["teletrasporto"] }],
    ["restrizione sconosciuta", { dietaryRestrictions: ["carnivoro"] }],
    [
      "testo libero al posto della lista",
      { dietaryRestrictions: "vegetariano" },
    ],
  ])("rifiuta: %s", (_label, extra) => {
    expect(() => createTripSchema.parse({ ...validTrip, ...extra })).toThrow();
  });
});

describe("updatePreferencesSchema — preferenze strutturate", () => {
  it("campi omessi restano invariati (undefined), non vengono azzerati", () => {
    const r = updatePreferencesSchema.parse({ budgetLevel: "moderate" });

    expect(r.interests).toBeUndefined();
    expect(r.pace).toBeUndefined();
    expect(r.mobilityNeeds).toBeUndefined();
    expect(r.dietaryRestrictions).toBeUndefined();
  });

  it("[] e null azzerano esplicitamente; i valori vengono normalizzati", () => {
    const r = updatePreferencesSchema.parse({
      budgetLevel: "economy",
      interests: [],
      pace: null,
      dietaryRestrictions: ["vegan", "halal", "vegan"],
    });

    expect(r.interests).toEqual([]);
    expect(r.pace).toBeNull();
    expect(r.dietaryRestrictions).toEqual(["vegan", "halal"]);
  });

  it("rifiuta valori fuori elenco", () => {
    expect(() =>
      updatePreferencesSchema.parse({ budgetLevel: "moderate", pace: "boh" }),
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
