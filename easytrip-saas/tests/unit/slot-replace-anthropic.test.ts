import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/ai/anthropic", () => ({
  ANTHROPIC_MODEL: "claude-test",
  anthropic: {
    messages: {
      create: mocks.messagesCreate,
    },
  },
}));

import { SlotReplaceService } from "@/server/services/trip/slotReplaceService";

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
      { name: "Alt1", distance: "100m", note: "A" },
      { name: "Alt2", distance: "200m", note: "B" },
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
      })
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
});
