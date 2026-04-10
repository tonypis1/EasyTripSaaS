import { describe, expect, it } from "vitest";
import {
  extractJsonText,
  parseAndValidateModelJson,
} from "@/lib/itinerary-model-schema";

function slot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "POI",
    place: "Centro",
    why: "Perché",
    startTime: "9:00",
    endTime: "11:00",
    durationMin: 120,
    googleMapsQuery: "POI Roma",
    bookingLink: null,
    tips: ["Meteo ok"],
    lat: 41.9,
    lng: 12.45,
    ...overrides,
  };
}

function restaurant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    meal: "pranzo",
    name: "Trattoria",
    cuisine: "locale",
    why: "Buona",
    budgetHint: "€15",
    distance: "100m",
    reservationNeeded: false,
    reservationTip: "",
    ...overrides,
  };
}

function day(n: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    dayNumber: n,
    title: `Giorno ${n}`,
    morning: slot(),
    afternoon: slot({ startTime: "14:00", endTime: "16:00" }),
    evening: slot({ startTime: "18:00", endTime: "20:00" }),
    zoneFocus: "Centro",
    dowWarning: "",
    localGem: "Gem",
    tips: "Suggerimenti",
    mapCenterLat: 41.9,
    mapCenterLng: 12.45,
    restaurants: [
      restaurant(),
      { ...restaurant(), meal: "cena", name: "Osteria" },
    ],
    ...overrides,
  };
}

function validPayload(numDays: number) {
  return JSON.stringify({
    optimizationScore: 8,
    days: Array.from({ length: numDays }, (_, i) => day(i + 1)),
  });
}

describe("extractJsonText", () => {
  it("returns raw when no fence", () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it("strips markdown json fence", () => {
    const inner = '{"optimizationScore":5,"days":[]}';
    expect(extractJsonText("```json\n" + inner + "\n```")).toBe(inner);
  });

  it("strips fence without json label", () => {
    expect(extractJsonText("```\n{}\n```")).toBe("{}");
  });
});

describe("parseAndValidateModelJson", () => {
  it("parses valid JSON for one day", () => {
    const r = parseAndValidateModelJson(validPayload(1), 1);
    expect(r.optimizationScore).toBe(8);
    expect(r.days).toHaveLength(1);
    expect(r.days[0].morning.startTime).toBe("09:00");
  });

  it("orders days by dayNumber 1..n", () => {
    const obj = {
      optimizationScore: 7,
      days: [day(2), day(1)],
    };
    const r = parseAndValidateModelJson(JSON.stringify(obj), 2);
    expect(r.days[0].dayNumber).toBe(1);
    expect(r.days[1].dayNumber).toBe(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAndValidateModelJson("not json", 1)).toThrow(
      /JSON non valido/,
    );
  });

  it("throws when day count mismatches", () => {
    expect(() => parseAndValidateModelJson(validPayload(2), 1)).toThrow(
      /Numero giorni non valido/,
    );
  });

  it("throws when a dayNumber is missing in sequence", () => {
    const bad = JSON.stringify({
      optimizationScore: 5,
      days: [day(1), day(3)],
    });
    expect(() => parseAndValidateModelJson(bad, 2)).toThrow(
      /Manca dayNumber=2/,
    );
  });

  it("throws on schema violation", () => {
    const bad = JSON.stringify({
      optimizationScore: 0,
      days: [day(1)],
    });
    expect(() => parseAndValidateModelJson(bad, 1)).toThrow(
      /Schema non valido/,
    );
  });

  it("throws when optimizationScore above 10", () => {
    const bad = JSON.stringify({
      optimizationScore: 11,
      days: [day(1)],
    });
    expect(() => parseAndValidateModelJson(bad, 1)).toThrow(
      /Schema non valido/,
    );
  });
});
