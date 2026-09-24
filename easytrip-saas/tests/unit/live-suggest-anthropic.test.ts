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
    ...overrides,
  };
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
});
