import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic", () => ({
  ANTHROPIC_MODEL: "claude-test",
  anthropic: {
    messages: {
      create: mocks.messagesCreate,
    },
  },
}));

import { ItineraryGenerationService } from "@/server/services/trip/itineraryGenerationService";

function slot(overrides: Record<string, unknown> = {}) {
  return {
    title: "POI",
    place: "Centro",
    why: "Perché sì",
    startTime: "09:00",
    endTime: "11:00",
    durationMin: 120,
    googleMapsQuery: "POI Roma",
    bookingLink: null,
    tips: ["Vai presto"],
    lat: 41.9,
    lng: 12.45,
    ...overrides,
  };
}

function restaurant(overrides: Record<string, unknown> = {}) {
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

function day(dayNumber: number) {
  return {
    dayNumber,
    title: `Giorno ${dayNumber}`,
    morning: slot(),
    afternoon: slot({ startTime: "14:00", endTime: "16:00" }),
    evening: slot({ startTime: "18:00", endTime: "20:00" }),
    zoneFocus: "Centro",
    dowWarning: "",
    localGem: "Gem",
    tips: "Consigli",
    mapCenterLat: 41.9,
    mapCenterLng: 12.45,
    restaurants: [
      restaurant(),
      { ...restaurant(), meal: "cena", name: "Osteria" },
    ],
  };
}

function validPayload(numDays: number) {
  return JSON.stringify({
    optimizationScore: 8,
    days: Array.from({ length: numDays }, (_, i) => day(i + 1)),
  });
}

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    destination: "Roma",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-02T00:00:00.000Z"),
    numDays: 2,
    tripType: "solo",
    style: null,
    budgetLevel: "moderate",
    usedZones: null,
    localPassCityCount: 0,
    locale: "it" as const,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.messagesCreate.mockReset();
});

describe("ItineraryGenerationService.generate", () => {
  it("ritorna il piano al primo tentativo se il JSON è valido (nessuna chiamata di riparazione)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    const result = await service.generate(baseInput());

    expect(result.optimizationScore).toBe(8);
    expect(result.days).toHaveLength(2);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("tenta una riparazione quando il primo JSON non supera la validazione, e usa la risposta riparata", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // 1 giorno invece dei 2 richiesti -> invalido
      .mockResolvedValueOnce(textResponse(validPayload(2))); // riparazione valida

    const service = new ItineraryGenerationService();
    const result = await service.generate(baseInput());

    expect(result.days).toHaveLength(2);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    // Il prompt di riparazione deve contenere il motivo dell'errore e il frammento precedente,
    // appesi come blocco finale dopo quello stabile (mai anteposti).
    const repairCallArgs = mocks.messagesCreate.mock.calls[1][0];
    const repairBlocks = repairCallArgs.messages[0].content;
    expect(repairBlocks.at(-1).text).toContain(
      "non ha superato la validazione",
    );
  });

  it("lancia un errore dopo il numero massimo di tentativi se il JSON resta invalido", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(1))); // sempre 1 giorno invece di 2

    const service = new ItineraryGenerationService();

    await expect(service.generate(baseInput())).rejects.toThrow(
      /dopo 3 tentativi/,
    );
    // attempt1(main+repair) + attempt2(main+repair) + attempt3(solo main) = 5.
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(5);
  });

  it("lancia un errore se Claude non restituisce un blocco testuale", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "image", source: {} }],
    });

    const service = new ItineraryGenerationService();

    await expect(service.generate(baseInput())).rejects.toThrow(
      "Claude non ha restituito un blocco testuale",
    );
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("passa il modello configurato e un max_tokens coerente con l'output atteso", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());

    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test", max_tokens: 12000 }),
    );
  });
});

describe("ItineraryGenerationService.generate — Structured Outputs", () => {
  it("vincola la risposta allo schema dell'itinerario via output_config.format (json_schema)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());

    const params = mocks.messagesCreate.mock.calls[0][0];
    expect(params.output_config.format.type).toBe("json_schema");
    const schema = params.output_config.format.schema;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual([
      "days",
      "optimizationScore",
    ]);
  });

  it("passa lo stesso schema anche nel tentativo di riparazione", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // numDays sbagliato: errore di business logic
      .mockResolvedValueOnce(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());

    const [first, repair] = mocks.messagesCreate.mock.calls.map((c) => c[0]);
    expect(repair.output_config).toEqual(first.output_config);
  });

  it("il numero di giorni resta validato lato server (lo schema non può esprimere minItems/maxItems > 1)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(1)));

    const service = new ItineraryGenerationService();
    await expect(service.generate(baseInput())).rejects.toThrow(
      /Numero giorni non valido/,
    );
  });
});

describe("ItineraryGenerationService.generate — grounding (EasyTrip Verified)", () => {
  const grounding = {
    fetchedAt: "2026-09-28T10:00:00.000Z",
    grounding: {
      areas: [
        {
          name: "Centro Storico",
          attractions: [{ name: "Colosseo", kind: "monument", note: "n" }],
          restaurants: [
            { name: "Trattoria Da Enzo", cuisine: "roman", note: "n" },
          ],
        },
      ],
    },
  };

  it("inserisce il blocco FONTI VERIFICATE nella parte stabile del prompt, prima di OUTPUT ATTESO", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ grounding }));

    const stable = mocks.messagesCreate.mock.calls[0][0].messages[0].content[0];
    expect(stable.text).toContain(
      "SEZIONE — FONTI VERIFICATE (ricerca web del 2026-09-28)",
    );
    expect(stable.text).toContain("Colosseo (monument)");
    expect(stable.text).toContain("Trattoria Da Enzo (roman)");
    expect(stable.text.indexOf("FONTI VERIFICATE")).toBeLessThan(
      stable.text.indexOf("SEZIONE — OUTPUT ATTESO"),
    );
    // Resta il blocco cacheable: i tentativi di riparazione lo leggono dalla cache.
    expect(stable.cache_control).toEqual({ type: "ephemeral" });
  });

  it("senza grounding il prompt non contiene il blocco (nessun cambiamento rispetto a prima)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());
    await service.generate(baseInput({ grounding: null }));

    for (const call of mocks.messagesCreate.mock.calls) {
      expect(call[0].messages[0].content[0].text).not.toContain(
        "FONTI VERIFICATE",
      );
    }
  });

  it("il tentativo di riparazione riusa byte-per-byte il blocco stabile con il grounding (cache hit)", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // numDays sbagliato
      .mockResolvedValueOnce(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ grounding }));

    const [first, repair] = mocks.messagesCreate.mock.calls.map(
      (c) => c[0].messages[0].content,
    );
    expect(repair[0]).toEqual(first[0]);
    expect(repair[0].text).toContain("FONTI VERIFICATE");
  });
});

describe("ItineraryGenerationService.generate — prompt caching", () => {
  it("marca con cache_control il blocco stabile del prompt (non le zone già usate)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ usedZones: "Centro, Trastevere" }));

    const content = mocks.messagesCreate.mock.calls[0][0].messages[0].content;
    expect(content).toHaveLength(2);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(content[0].text).toContain("SEZIONE — OUTPUT ATTESO");
    expect(content[0].text).not.toContain("ZONE GIÀ USATE");
    expect(content[1].cache_control).toBeUndefined();
    expect(content[1].text).toContain("Centro, Trastevere");
  });

  it("senza zone già usate manda un solo blocco (comunque cacheable)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ usedZones: null }));

    const content = mocks.messagesCreate.mock.calls[0][0].messages[0].content;
    expect(content).toHaveLength(1);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("il tentativo di riparazione riusa byte-per-byte il blocco stabile del tentativo originale (cache hit) e appende in coda", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // invalido: 1 giorno invece di 2
      .mockResolvedValueOnce(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ usedZones: "Centro" }));

    const firstCallContent =
      mocks.messagesCreate.mock.calls[0][0].messages[0].content;
    const repairCallContent =
      mocks.messagesCreate.mock.calls[1][0].messages[0].content;

    // Stesso blocco stabile (indice 0) e stesso blocco zone (indice 1), byte-per-byte.
    expect(repairCallContent[0]).toEqual(firstCallContent[0]);
    expect(repairCallContent[1]).toEqual(firstCallContent[1]);
    // Il blocco di riparazione è appeso in coda, senza cache_control.
    expect(repairCallContent).toHaveLength(firstCallContent.length + 1);
    expect(repairCallContent.at(-1).cache_control).toBeUndefined();
  });

  it("due rigenerazioni dello stesso trip con zone diverse condividono lo stesso blocco stabile cacheable", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput({ usedZones: null }));
    const firstGenContent =
      mocks.messagesCreate.mock.calls[0][0].messages[0].content;

    await service.generate(baseInput({ usedZones: "Centro" }));
    const secondGenContent =
      mocks.messagesCreate.mock.calls[1][0].messages[0].content;

    // Stessa destinazione/date/budget/stile/numDays/locale → blocco stabile
    // identico tra la generazione iniziale e la rigenerazione successiva,
    // anche se le zone già usate cambiano.
    expect(secondGenContent[0]).toEqual(firstGenContent[0]);
  });
});
