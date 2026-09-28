import { beforeEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  messagesCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    day: { findFirst: mocks.findFirst },
  },
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    ai: { anthropicApiKey: "sk-ant-test", anthropicModel: "claude-test" },
  },
}));

vi.mock("@/lib/ai/anthropic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/anthropic")>();
  return {
    ...actual,
    ANTHROPIC_MODEL: "claude-test",
    anthropic: {
      messages: {
        create: mocks.messagesCreate,
      },
    },
  };
});

import { LiveSuggestService } from "@/server/services/trip/liveSuggestService";

function suggestion(overrides: Record<string, unknown> = {}) {
  return {
    name: "Gelateria Del Teatro",
    type: "gelateria",
    distance: "150m",
    walkMin: 3,
    why: "Gelato artigianale molto apprezzato, comodo e vicino",
    durationMin: 20,
    googleMapsQuery: "Gelateria Del Teatro Roma",
    bookingLink: null,
    indoor: true,
    budgetHint: "€3-6",
    tips: ["Vai presto per evitare la fila"],
    lat: 41.9,
    lng: 12.45,
    ...overrides,
  };
}

function validPayload() {
  return JSON.stringify({
    contextNote: "Zona con buona scelta di alternative a pochi passi",
    suggestions: [
      suggestion({ name: "A" }),
      suggestion({ name: "B" }),
      suggestion({ name: "C" }),
    ],
  });
}

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function baseDay(overrides: Record<string, unknown> = {}) {
  return {
    id: "day1",
    dayNumber: 1,
    morning: "{}",
    afternoon: "{}",
    evening: "{}",
    tripVersion: {
      trip: {
        id: "trip1",
        organizerId: "org1",
        destination: "Roma",
        budgetLevel: "moderate",
        style: null,
        organizer: { language: "it" },
      },
    },
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    organizerId: "org1",
    tripId: "trip1",
    dayId: "day1",
    lat: 41.9,
    lng: 12.45,
    reason: "bored",
    currentSlot: null,
    localHour: 14, // pomeriggio, valore neutro di default per i test esistenti
    ...overrides,
  };
}

/** Estrae il testo del prompt utente inviato ad Anthropic nella chiamata mockata all'indice dato (default: la prima). */
function lastPromptTextForCall(callIndex = 0): string {
  const call = mocks.messagesCreate.mock.calls[callIndex];
  const args = call[0] as { messages: { content: string }[] };
  return args.messages[0].content;
}

beforeEach(() => {
  mocks.findFirst.mockReset();
  mocks.messagesCreate.mockReset();
  mocks.findFirst.mockResolvedValue(baseDay());
});

describe("LiveSuggestService.suggest — chiamata Anthropic", () => {
  it("ritorna i suggerimenti quando la risposta è JSON valido", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload()));

    const service = new LiveSuggestService();
    const result = await service.suggest(baseInput());

    expect(result.suggestions).toHaveLength(3);
  });

  it("passa timeout e maxRetries per-richiesta ad anthropic.messages.create", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload()));

    const service = new LiveSuggestService();
    await service.suggest(baseInput());

    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test" }),
      { timeout: 20_000, maxRetries: 1 },
    );
  });

  it("lancia AppError 502 AI_ERROR se la risposta non ha un blocco testuale", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "image", source: {} }],
    });

    const service = new LiveSuggestService();
    await expect(service.suggest(baseInput())).rejects.toMatchObject({
      code: "AI_ERROR",
      statusCode: 502,
    });
  });

  it("mappa un timeout Anthropic su AppError 503 AI_TIMEOUT (degradazione controllata)", async () => {
    mocks.messagesCreate.mockRejectedValue(
      new Anthropic.APIConnectionTimeoutError(),
    );

    const service = new LiveSuggestService();
    await expect(service.suggest(baseInput())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      statusCode: 503,
    });
  });

  it("usa l'ora locale del dispositivo (localHour) per il time-of-day, non l'orario del server", async () => {
    mocks.messagesCreate.mockResolvedValue(textResponse(validPayload()));

    const service = new LiveSuggestService();

    // 21:00 locali a destinazione: senza il fix sarebbe sempre "mattina/pomeriggio"
    // se il server gira in UTC e il vecchio calcolo era UTC+1 fisso.
    await service.suggest(baseInput({ localHour: 21 }));
    expect(lastPromptTextForCall()).toContain("Momento della giornata: sera");

    mocks.messagesCreate.mockClear();
    await service.suggest(baseInput({ localHour: 8 }));
    expect(lastPromptTextForCall()).toContain(
      "Momento della giornata: mattina",
    );
  });

  it("mappa un errore Anthropic generico (es. overload/rate limit) su AppError 502 AI_UNAVAILABLE", async () => {
    mocks.messagesCreate.mockRejectedValue(
      new Anthropic.InternalServerError(
        503,
        { type: "error", error: { type: "overloaded_error", message: "x" } },
        "overloaded",
        new Headers(),
      ),
    );

    const service = new LiveSuggestService();
    await expect(service.suggest(baseInput())).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      statusCode: 502,
    });
  });

  it("ripara un primo JSON schema-non-conforme e ritorna il risultato del secondo tentativo invece di fallire con 502", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce(
        textResponse(JSON.stringify({ suggestions: [] })), // schema non conforme: servono 3 suggestions
      )
      .mockResolvedValueOnce(textResponse(validPayload()));

    const service = new LiveSuggestService();
    const result = await service.suggest(baseInput());

    expect(result.suggestions).toHaveLength(3);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    const repairContent = lastPromptTextForCall(1);
    expect(repairContent).toContain("non ha superato la validazione");
  });

  it("lancia AppError 502 AI_SCHEMA se anche il tentativo di riparazione resta non conforme", async () => {
    mocks.messagesCreate.mockResolvedValue(
      textResponse(JSON.stringify({ suggestions: [] })),
    );

    const service = new LiveSuggestService();
    await expect(service.suggest(baseInput())).rejects.toMatchObject({
      code: "AI_SCHEMA",
      statusCode: 502,
    });
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
  });
});
