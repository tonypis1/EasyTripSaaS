import { describe, expect, it } from "vitest";
import { parseLiveSuggestModelJson } from "@/server/services/trip/liveSuggestService";

const validJson = JSON.stringify({
  contextNote: "Ecco tre alternative vicine.",
  suggestions: [
    {
      name: "Caffè",
      type: "bar",
      distance: "100m",
      walkMin: 2,
      why: "Perfetto per una pausa veloce con vista",
      durationMin: 30,
      googleMapsQuery: "Caffè Roma Centro",
      bookingLink: null,
      indoor: true,
      budgetHint: "€5",
      tips: ["Prova il cappuccino"],
      lat: 41.9,
      lng: 12.45,
    },
    {
      name: "Museo",
      type: "museo",
      distance: "200m",
      walkMin: 4,
      why: "Ottimo per la pioggia con collezione locale",
      durationMin: 60,
      googleMapsQuery: "Museo Roma",
      bookingLink: null,
      indoor: true,
      budgetHint: "€12",
      tips: ["Biglietti online"],
      lat: 41.901,
      lng: 12.451,
    },
    {
      name: "Parco",
      type: "parco",
      distance: "300m",
      walkMin: 5,
      why: "Aria aperta dopo il museo",
      durationMin: 45,
      googleMapsQuery: "Parco Roma",
      bookingLink: null,
      indoor: false,
      budgetHint: "Gratis",
      tips: ["Porta acqua"],
      lat: 41.902,
      lng: 12.452,
    },
  ],
});

describe("parseLiveSuggestModelJson", () => {
  it("parses valid fenced JSON", () => {
    const r = parseLiveSuggestModelJson("```json\n" + validJson + "\n```");
    expect(r.contextNote).toContain("alternative");
    expect(r.suggestions).toHaveLength(3);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLiveSuggestModelJson("not json")).toThrow(
      "LIVE_SUGGEST_JSON_PARSE"
    );
  });

  it("throws on schema violation", () => {
    const bad = JSON.stringify({
      contextNote: "x",
      suggestions: [],
    });
    expect(() => parseLiveSuggestModelJson(bad)).toThrow(/Schema live suggest/);
  });
});
