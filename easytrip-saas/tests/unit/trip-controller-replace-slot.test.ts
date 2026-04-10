import { describe, expect, it, vi } from "vitest";
import { TripController } from "@/server/controllers/TripController";
import type { TripService } from "@/server/services/trip/tripService";
import type { AuthService } from "@/server/services/auth/authService";
import type { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import type { LiveSuggestService } from "@/server/services/trip/liveSuggestService";

describe("TripController.replaceSlot", () => {
  it("returns ok when slot replace succeeds", async () => {
    const tripService = {} as TripService;
    const authService = {
      getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }),
    } as unknown as AuthService;
    const payload = {
      replacement: {
        title: "Nuovo",
        place: "Roma",
        why: "x",
        startTime: "09:00",
        endTime: "11:00",
        durationMin: 120,
        googleMapsQuery: "Nuovo Roma",
        bookingLink: null,
        tips: ["t"],
        lat: 41.9,
        lng: 12.4,
      },
      whyNotOriginal: "chiuso",
      geoContinuityNote: "ok",
      dayRouteUpdated: "ok",
      alternatives: [
        { name: "A", distance: "1", note: "n" },
        { name: "B", distance: "2", note: "n" },
      ],
    };
    const slotReplaceService = {
      replaceSlot: vi.fn().mockResolvedValue(payload),
    } as unknown as SlotReplaceService;
    const liveSuggestService = {} as LiveSuggestService;

    const controller = new TripController(
      tripService,
      authService,
      slotReplaceService,
      liveSuggestService
    );

    const req = new Request("http://localhost/api/trips/t1/replace-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayId: "day-1",
        slot: "morning",
        lat: 41.9,
        lng: 12.4,
      }),
    });

    const res = await controller.replaceSlot("t1", req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: typeof payload };
    expect(json.ok).toBe(true);
    expect(json.data.replacement.title).toBe("Nuovo");
    expect(slotReplaceService.replaceSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        organizerId: "user-1",
        tripId: "t1",
        dayId: "day-1",
        slot: "morning",
      })
    );
  });

  it("returns 400 on invalid JSON body", async () => {
    const controller = new TripController(
      {} as TripService,
      { getOrCreateCurrentUser: vi.fn() } as unknown as AuthService,
      { replaceSlot: vi.fn() } as unknown as SlotReplaceService,
      {} as LiveSuggestService
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      body: "not-json",
    });
    const res = await controller.replaceSlot("t1", req);
    expect(res.status).toBe(400);
  });
});
