import { beforeEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateDay: vi.fn(),
  messagesCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    day: {
      findFirst: mocks.findFirst,
      update: mocks.updateDay,
    },
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

import { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import type { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import type { GeoScoreService } from "@/server/services/trip/geoScoreService";

function altSlot(title: string) {
  return {
    title,
    place: "Centro",
    why: "Alternativa valida",
    startTime: "10:00",
    endTime: "12:00",
    durationMin: 120,
    googleMapsQuery: `${title} Roma`,
    bookingLink: null,
    tips: ["Vai presto"],
    lat: 41.91,
    lng: 12.46,
  };
}

function aiPayload() {
  return {
    replacement: {
      title: "Museo X",
      place: "Centro",
      why: "Bello",
      startTime: "10:00",
      endTime: "12:00",
      durationMin: 120,
      googleMapsQuery: "Museo X Roma",
      bookingLink: null,
      tips: ["Prenota online"],
      lat: 41.9,
      lng: 12.45,
    },
    whyNotOriginal: "Chiuso per festa",
    geoContinuityNote: "Resti in zona",
    dayRouteUpdated: "Mattina aggiornata",
    alternatives: [
      { distance: "100m", note: "A", slot: altSlot("Alt1") },
      { distance: "200m", note: "B", slot: altSlot("Alt2") },
    ],
  };
}

describe("SlotReplaceService + mock Anthropic", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateDay.mockReset();
    mocks.messagesCreate.mockReset();
  });

  it("throws AppError 502 when Anthropic returns no text block", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "day1",
      morning: JSON.stringify({ title: "Old", place: "Roma" }),
      afternoon: "{}",
      evening: "{}",
      dayNumber: 1,
      zoneFocus: "Centro",
      tripVersion: {
        trip: {
          id: "trip1",
          organizerId: "org1",
          destination: "Roma",
          budgetLevel: "moderate",
          style: null,
          _count: { members: 1 },
        },
      },
    });
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "image", source: {} }],
    });

    const svc = new SlotReplaceService();
    await expect(
      svc.replaceSlot({
        organizerId: "org1",
        tripId: "trip1",
        dayId: "day1",
        slot: "morning",
        lat: 41.9,
        lng: 12.45,
      }),
    ).rejects.toMatchObject({ code: "AI_ERROR", statusCode: 502 });
  });

  it("persists replacement when AI returns valid JSON", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "day1",
      morning: JSON.stringify({ title: "Old", place: "Roma" }),
      afternoon: "{}",
      evening: "{}",
      dayNumber: 1,
      zoneFocus: "Centro",
      tripVersion: {
        trip: {
          id: "trip1",
          organizerId: "org1",
          destination: "Roma",
          budgetLevel: "moderate",
          style: null,
          _count: { members: 1 },
        },
      },
    });
    mocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify(aiPayload()),
        },
      ],
    });
    mocks.updateDay.mockResolvedValue({});

    const svc = new SlotReplaceService();
    const result = await svc.replaceSlot({
      organizerId: "org1",
      tripId: "trip1",
      dayId: "day1",
      slot: "morning",
      lat: 41.9,
      lng: 12.45,
    });

    expect(result.replacement.title).toBe("Museo X");
    expect(mocks.updateDay).toHaveBeenCalled();
  });

  function dayFixture() {
    return {
      id: "day1",
      tripVersionId: "ver1",
      morning: JSON.stringify({ title: "Old", place: "Roma" }),
      afternoon: "{}",
      evening: "{}",
      dayNumber: 1,
      zoneFocus: "Centro",
      tripVersion: {
        trip: {
          id: "trip1",
          organizerId: "org1",
          destination: "Roma",
          budgetLevel: "moderate",
          style: null,
          _count: { members: 1 },
        },
      },
    };
  }

  function callArgs() {
    return {
      organizerId: "org1",
      tripId: "trip1",
      dayId: "day1",
      slot: "morning" as const,
      lat: 41.9,
      lng: 12.45,
    };
  }

  it("passa timeout e maxRetries per-richiesta ad anthropic.messages.create", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(aiPayload()) }],
    });
    mocks.updateDay.mockResolvedValue({});

    const svc = new SlotReplaceService();
    await svc.replaceSlot(callArgs());

    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test" }),
      { timeout: 20_000, maxRetries: 1 },
    );
  });

  it("dopo aver salvato lo slot riallinea il GeoScore della versione del giorno", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(aiPayload()) }],
    });
    mocks.updateDay.mockResolvedValue({});
    const geoScore = {
      refreshForVersion: vi.fn().mockResolvedValue(8.4),
    } as unknown as GeoScoreService;

    const svc = new SlotReplaceService(
      { createDraft: vi.fn() } as unknown as SlotProposalRepository,
      geoScore,
    );
    await svc.replaceSlot(callArgs());

    expect(geoScore.refreshForVersion).toHaveBeenCalledWith("ver1");
    // Il ricalcolo legge i giorni da DB: deve avvenire DOPO l'update dello slot.
    expect(mocks.updateDay.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(geoScore.refreshForVersion).mock.invocationCallOrder[0],
    );
  });

  it("non tocca il GeoScore se la sostituzione fallisce prima di salvare", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockRejectedValue(
      new Anthropic.APIConnectionTimeoutError(),
    );
    const geoScore = {
      refreshForVersion: vi.fn(),
    } as unknown as GeoScoreService;

    const svc = new SlotReplaceService(
      { createDraft: vi.fn() } as unknown as SlotProposalRepository,
      geoScore,
    );
    await expect(svc.replaceSlot(callArgs())).rejects.toBeDefined();

    expect(mocks.updateDay).not.toHaveBeenCalled();
    expect(geoScore.refreshForVersion).not.toHaveBeenCalled();
  });

  it("mappa un timeout Anthropic su AppError 503 AI_TIMEOUT (degradazione controllata)", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockRejectedValue(
      new Anthropic.APIConnectionTimeoutError(),
    );

    const svc = new SlotReplaceService();
    await expect(svc.replaceSlot(callArgs())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      statusCode: 503,
    });
    expect(mocks.updateDay).not.toHaveBeenCalled();
  });

  it("mappa un errore Anthropic generico (es. overload/rate limit) su AppError 502 AI_UNAVAILABLE", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockRejectedValue(
      new Anthropic.InternalServerError(
        503,
        { type: "error", error: { type: "overloaded_error", message: "x" } },
        "overloaded",
        new Headers(),
      ),
    );

    const svc = new SlotReplaceService();
    await expect(svc.replaceSlot(callArgs())).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      statusCode: 502,
    });
  });

  it("ripara un primo JSON schema-non-conforme e persiste il risultato del secondo tentativo invece di fallire con 502", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ replacement: {} }) }], // schema non conforme
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(aiPayload()) }],
      });
    mocks.updateDay.mockResolvedValue({});

    const svc = new SlotReplaceService();
    const result = await svc.replaceSlot(callArgs());

    expect(result.replacement.title).toBe("Museo X");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    // Il tentativo di riparazione appende il suffisso al prompt originale (stringa unica).
    const repairContent = mocks.messagesCreate.mock.calls[1][0].messages[0]
      .content as string;
    expect(repairContent).toContain("non ha superato la validazione");
  });

  it("lancia AppError 502 AI_SCHEMA se anche il tentativo di riparazione resta non conforme", async () => {
    mocks.findFirst.mockResolvedValue(dayFixture());
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ replacement: {} }) }],
    });

    const svc = new SlotReplaceService();
    await expect(svc.replaceSlot(callArgs())).rejects.toMatchObject({
      code: "AI_SCHEMA",
      statusCode: 502,
    });
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
    expect(mocks.updateDay).not.toHaveBeenCalled();
  });
});

describe("SlotReplaceService — bozza di votazione di gruppo", () => {
  function dayWithMembers(members: number) {
    return {
      id: "day1",
      morning: JSON.stringify({ title: "Old", place: "Roma" }),
      afternoon: "{}",
      evening: "{}",
      dayNumber: 1,
      zoneFocus: "Centro",
      tripVersion: {
        trip: {
          id: "trip1",
          organizerId: "org1",
          destination: "Roma",
          budgetLevel: "moderate",
          style: null,
          _count: { members },
        },
      },
    };
  }

  const input = {
    organizerId: "org1",
    tripId: "trip1",
    dayId: "day1",
    slot: "morning" as const,
    lat: 41.9,
    lng: 12.45,
  };

  function setup(
    members: number,
    createDraft = vi.fn().mockResolvedValue({ id: "prop1" }),
  ) {
    mocks.findFirst.mockResolvedValue(dayWithMembers(members));
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(aiPayload()) }],
    });
    mocks.updateDay.mockResolvedValue({});
    const proposals = { createDraft } as unknown as SlotProposalRepository;
    return { svc: new SlotReplaceService(proposals), createDraft };
  }

  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateDay.mockReset();
    mocks.messagesCreate.mockReset();
  });

  it("con almeno 2 membri salva una bozza [attuale, alt1, alt2] e ritorna il proposalId", async () => {
    const { svc, createDraft } = setup(3);

    const result = await svc.replaceSlot(input);

    expect(result.proposalId).toBe("prop1");
    const draft = createDraft.mock.calls[0][0];
    expect(draft.dayId).toBe("day1");
    expect(draft.slotKey).toBe("morning");
    // Opzione 0 = lo slot appena applicato; 1..2 = le alternative complete dell'AI
    expect(
      draft.options.map((o: { slot: { title: string } }) => o.slot.title),
    ).toEqual(["Museo X", "Alt1", "Alt2"]);
    expect(draft.options[0]).toMatchObject({ distance: null, note: null });
    expect(draft.options[1]).toMatchObject({ distance: "100m", note: "A" });
  });

  it("le alternative ritornate sono slot completi con `name` derivato dal titolo", async () => {
    const { svc } = setup(3);

    const result = await svc.replaceSlot(input);

    expect(result.alternatives[0]).toMatchObject({
      name: "Alt1",
      distance: "100m",
      note: "A",
    });
    expect(result.alternatives[0].slot.startTime).toBe("10:00");
  });

  it("con un solo membro (viaggio solo) non crea alcuna bozza", async () => {
    const { svc, createDraft } = setup(1);

    const result = await svc.replaceSlot(input);

    expect(result.proposalId).toBeNull();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("se la creazione della bozza fallisce la sostituzione è comunque applicata", async () => {
    const { svc } = setup(3, vi.fn().mockRejectedValue(new Error("db down")));

    const result = await svc.replaceSlot(input);

    expect(result.proposalId).toBeNull();
    expect(result.replacement.title).toBe("Museo X");
    expect(mocks.updateDay).toHaveBeenCalled();
  });

  it("un'alternativa nel vecchio formato (solo nome/nota, senza slot) non passa la validazione", async () => {
    mocks.findFirst.mockResolvedValue(dayWithMembers(3));
    const legacy = {
      ...aiPayload(),
      alternatives: [
        { name: "Alt1", distance: "100m", note: "A" },
        { name: "Alt2", distance: "200m", note: "B" },
      ],
    };
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(legacy) }],
    });

    const svc = new SlotReplaceService({
      createDraft: vi.fn(),
    } as unknown as SlotProposalRepository);

    await expect(svc.replaceSlot(input)).rejects.toMatchObject({
      code: "AI_SCHEMA",
    });
    expect(mocks.updateDay).not.toHaveBeenCalled();
  });
});
