import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic", () => ({
  ANTHROPIC_MODEL: "claude-test",
  // La generazione usa lo streaming: `finalMessage()` restituisce il messaggio completo.
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => ({
        finalMessage: () => mocks.messagesCreate(...args),
      }),
    },
  },
}));

import {
  ItineraryGenerationService,
  nextGenerationCall,
  type FailedGeneration,
} from "@/server/services/trip/itineraryGenerationService";

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

  it("senza blocco testuale non c'è nulla da riparare: nuovi tentativi, poi errore", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "image", source: {} }],
    });

    const service = new ItineraryGenerationService();

    await expect(service.generate(baseInput())).rejects.toThrow(
      "Claude non ha restituito un blocco testuale",
    );
    // 3 tentativi da zero, nessuna riparazione.
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(3);
  });

  it("passa il modello configurato e un max_tokens che lascia spazio a ragionamento + JSON (cresce con i giorni)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());

    // 2 giorni: 16.000 + 2 × 2.500. Il vecchio limite fisso (12.000) troncava già 3 giorni.
    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test", max_tokens: 21_000 }),
    );
  });

  it("il budget di output ha un tetto anche per viaggi molto lunghi", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    await new ItineraryGenerationService()
      .generate({ ...baseInput(), numDays: 40 })
      .catch(() => {}); // 2 giorni restituiti invece di 40: qui conta solo la richiesta

    expect(mocks.messagesCreate.mock.calls[0][0].max_tokens).toBe(64_000);
  });

  it("risposta troncata per max_tokens: mai riparata (JSON incompleto), si riprova da zero", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce({
        ...textResponse(validPayload(2)),
        stop_reason: "max_tokens",
      })
      .mockResolvedValueOnce(textResponse(validPayload(2)));

    const result = await new ItineraryGenerationService().generate(baseInput());

    expect(result.days).toHaveLength(2);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    // Il secondo è un tentativo da zero, non una riparazione del testo troncato.
    expect(
      mocks.messagesCreate.mock.calls[1][0].messages[0].content,
    ).toHaveLength(
      mocks.messagesCreate.mock.calls[0][0].messages[0].content.length,
    );
  });

  it("risposte sempre troncate: errore esplicito dopo i tentativi", async () => {
    mocks.messagesCreate.mockResolvedValue({
      ...textResponse(validPayload(2)),
      stop_reason: "max_tokens",
    });

    await expect(
      new ItineraryGenerationService().generate(baseInput()),
    ).rejects.toThrow("Risposta troncata (max_tokens)");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(3);
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

describe("ItineraryGenerationService.generate — preferenze strutturate", () => {
  const veg = {
    interests: [],
    pace: null,
    mobilityNeeds: [],
    dietaryRestrictions: ["vegetarian" as const],
  };

  /** Payload in cui ogni ristorante dichiara le restrizioni indicate (una lista per ristorante, uguale per tutti i giorni). */
  function payloadWithFit(numDays: number, fit: string[]) {
    return JSON.stringify({
      optimizationScore: 8,
      days: Array.from({ length: numDays }, (_, i) => ({
        ...day(i + 1),
        restaurants: [
          restaurant({ dietaryFit: fit }),
          restaurant({ meal: "cena", name: "Osteria", dietaryFit: fit }),
        ],
      })),
    });
  }

  it("senza preferenze il prompt non cambia: nessun blocco, identico a preferenze vuote", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    const service = new ItineraryGenerationService();
    await service.generate(baseInput());
    await service.generate(
      baseInput({
        preferences: {
          interests: [],
          pace: null,
          mobilityNeeds: [],
          dietaryRestrictions: [],
        },
      }),
    );

    const [a, b] = mocks.messagesCreate.mock.calls.map(
      (c) => c[0].messages[0].content[0].text,
    );
    expect(a).not.toContain("PREFERENZE DEL VIAGGIATORE");
    expect(b).toBe(a);
  });

  it("il blocco PREFERENZE sta nella parte stabile (cacheable), prima di OUTPUT ATTESO, e la riparazione lo riusa byte-per-byte", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // numDays sbagliato → riparazione
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, ["vegetarian"])));

    const service = new ItineraryGenerationService();
    await service.generate(
      baseInput({
        preferences: { ...veg, interests: ["art_museums"], pace: "relaxed" },
      }),
    );

    const [first, repair] = mocks.messagesCreate.mock.calls.map(
      (c) => c[0].messages[0].content,
    );
    expect(first[0].cache_control).toEqual({ type: "ephemeral" });
    expect(first[0].text).toContain("PREFERENZE DEL VIAGGIATORE");
    expect(first[0].text).toContain("arte e musei");
    expect(first[0].text).toContain("RILASSATO");
    expect(first[0].text).toContain("vegetariano");
    expect(first[0].text.indexOf("PREFERENZE DEL VIAGGIATORE")).toBeLessThan(
      first[0].text.indexOf("SEZIONE — OUTPUT ATTESO"),
    );
    expect(repair[0]).toEqual(first[0]);
  });

  it("il formato di output chiede sempre dietaryFit per ogni ristorante", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    await new ItineraryGenerationService().generate(baseInput());

    const stable = mocks.messagesCreate.mock.calls[0][0].messages[0].content[0];
    expect(stable.text).toContain('"dietaryFit"');
    expect(stable.text).toContain("vegetarian, vegan, gluten_free");
  });

  it("dietaryFit dichiarato viene letto e conservato nel risultato", async () => {
    mocks.messagesCreate.mockResolvedValue(
      textResponse(payloadWithFit(2, ["vegetarian", "gluten_free"])),
    );

    const result = await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(result.days[0].restaurants[0].dietaryFit).toEqual([
      "vegetarian",
      "gluten_free",
    ]);
  });

  it("ristoranti che soddisfano le restrizioni: una sola chiamata", async () => {
    mocks.messagesCreate.mockResolvedValue(
      textResponse(payloadWithFit(2, ["vegetarian"])),
    );

    await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("un locale vegano soddisfa la richiesta vegetariana", async () => {
    mocks.messagesCreate.mockResolvedValue(
      textResponse(payloadWithFit(2, ["vegan"])),
    );

    await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("ristoranti che non dichiarano la restrizione: il primo tentativo viene rifiutato con il motivo e si ripara", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, []))) // nessun locale dichiara "vegetarian"
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, ["vegetarian"])));

    const result = await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    const repairText =
      mocks.messagesCreate.mock.calls[1][0].messages[0].content.at(-1).text;
    expect(repairText).toContain("dietaryFit");
    expect(repairText).toContain('"Trattoria" (manca: vegetarian)');
    expect(result.days[0].restaurants[0].dietaryFit).toEqual(["vegetarian"]);
  });

  it("se anche la risposta riparata ha lacune si accetta comunque (vincolo morbido): l'itinerario pagato non fallisce", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(payloadWithFit(2, [])));

    const result = await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    // main (rifiutato) + riparazione (accettata con avviso): mai un ciclo di rigenerazioni.
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    expect(result.days).toHaveLength(2);
  });

  it("senza restrizioni alimentari ristoranti senza dietaryFit sono validi (nessuna chiamata extra)", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    await new ItineraryGenerationService().generate(
      baseInput({
        preferences: {
          interests: ["nature"],
          pace: "packed",
          mobilityNeeds: ["stroller"],
          dietaryRestrictions: [],
        },
      }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("le sole allergie non creano un contratto dietaryFit (l'AI non può garantirle) ma il prompt le tiene presenti", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload(2)));

    await new ItineraryGenerationService().generate(
      baseInput({
        preferences: {
          interests: [],
          pace: null,
          mobilityNeeds: [],
          dietaryRestrictions: ["nut_allergy"],
        },
      }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
    const text =
      mocks.messagesCreate.mock.calls[0][0].messages[0].content[0].text;
    expect(text).toContain("allergia alla frutta a guscio");
    expect(text).toContain("non fare promesse di sicurezza");
  });

  it("anche l'ultimo tentativo accetta le lacune dietetiche (vincolo morbido): l'itinerario pagato non fallisce", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // 1: struttura errata
      .mockResolvedValueOnce(textResponse(validPayload(1))) // riparazione 1: ancora errata
      .mockResolvedValueOnce(textResponse(validPayload(1))) // 2: errata
      .mockResolvedValueOnce(textResponse(validPayload(1))) // riparazione 2: errata
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, []))); // 3: valida ma con lacune

    const result = await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(5);
    expect(result.days).toHaveLength(2);
  });

  it("l'errore finale non contiene le restrizioni alimentari (finisce nei log di Inngest)", async () => {
    // Lacune al tentativo 1 (strict) → riparazione con struttura errata → ... → tentativo 3 errato.
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, [])))
      .mockResolvedValue(textResponse(validPayload(1)));

    const error = await new ItineraryGenerationService()
      .generate(baseInput({ preferences: veg }))
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("vegetarian");
    // Il dettaglio resta solo nel prompt di riparazione per il modello.
    const repairText =
      mocks.messagesCreate.mock.calls[1][0].messages[0].content.at(-1).text;
    expect(repairText).toContain("(manca: vegetarian)");
  });

  it("errori strutturali e lacune dietetiche insieme: il conteggio delle chiamate resta limitato", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(textResponse(validPayload(1))) // struttura errata
      .mockResolvedValueOnce(textResponse(payloadWithFit(2, []))); // struttura ok, lacune → accettata (lenient)

    const result = await new ItineraryGenerationService().generate(
      baseInput({ preferences: veg }),
    );

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    expect(result.days).toHaveLength(2);
  });
});

describe("nextGenerationCall — sequenza delle chiamate", () => {
  const failed = (raw: string | null) => ({
    ok: false as const,
    raw,
    reason: "motivo",
    logReason: "motivo",
  });

  it("tentativo, riparazione, tentativo, riparazione, tentativo: poi basta", () => {
    const seen: string[] = [];
    let previous: FailedGeneration | null = null;
    for (
      let call = nextGenerationCall(null);
      call;
      call = nextGenerationCall(previous)
    ) {
      seen.push(`${call.repair ? "r" : "t"}${call.attempt}`);
      previous = { call, outcome: failed("{}") };
    }
    expect(seen).toEqual(["t1", "r1", "t2", "r2", "t3"]);
  });

  it("niente da riparare (troncata o senza testo): si passa al tentativo successivo", () => {
    expect(
      nextGenerationCall({
        call: { attempt: 1, repair: null },
        outcome: failed(null),
      }),
    ).toEqual({ attempt: 2, repair: null });
  });

  it("la riparazione riceve il testo e il motivo dettagliato del tentativo", () => {
    expect(
      nextGenerationCall({
        call: { attempt: 2, repair: null },
        outcome: { ok: false, raw: "{x}", reason: "dettaglio", logReason: "n" },
      }),
    ).toEqual({ attempt: 2, repair: { raw: "{x}", reason: "dettaglio" } });
  });
});
