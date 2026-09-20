import { describe, expect, it, vi } from "vitest";
import { TripController } from "@/server/controllers/TripController";
import type { TripService } from "@/server/services/trip/tripService";
import type { AuthService } from "@/server/services/auth/authService";
import type { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import type { LiveSuggestService } from "@/server/services/trip/liveSuggestService";

/**
 * Blocca la semantica corretta di DELETE /api/trips/[tripId] vs
 * POST /api/trips/[tripId]/cancel: prima di questo fix, `deleteById`
 * (agganciato al verbo DELETE) chiamava in realtà `cancelTripWithCredit`
 * (un'azione monetaria di rimborso), mentre il vero soft-delete era dietro
 * un endpoint chiamato "archive". Un maintainer che avesse collegato una UI
 * "elimina viaggio" al verbo DELETE si sarebbe aspettato un archivio, non
 * un rimborso.
 */
function makeController(tripServiceOverrides: Record<string, unknown> = {}) {
  const tripService = {
    archiveTrip: vi.fn().mockResolvedValue({ deleted: true }),
    cancelTripWithCredit: vi.fn().mockResolvedValue({
      cancelled: true,
      creditAmount: 3.99,
      creditExpiresAt: "2026-12-31",
    }),
    ...tripServiceOverrides,
  } as unknown as TripService;

  const controller = new TripController(
    tripService,
    {} as AuthService,
    {} as SlotReplaceService,
    {} as LiveSuggestService,
  );

  return { controller, tripService };
}

describe("TripController.deleteById (DELETE /api/trips/[tripId])", () => {
  it("archivia il trip (soft-delete), non emette alcun rimborso", async () => {
    const { controller, tripService } = makeController();

    const res = await controller.deleteById("trip1");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, data: { archived: true } });
    expect(tripService.archiveTrip).toHaveBeenCalledWith("trip1");
    expect(tripService.cancelTripWithCredit).not.toHaveBeenCalled();
  });
});

describe("TripController.cancelById (POST /api/trips/[tripId]/cancel)", () => {
  it("cancella il trip con rimborso a credito", async () => {
    const { controller, tripService } = makeController();

    const res = await controller.cancelById("trip1");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      ok: true,
      cancelled: true,
      creditAmount: 3.99,
      creditExpiresAt: "2026-12-31",
    });
    expect(tripService.cancelTripWithCredit).toHaveBeenCalledWith("trip1");
    expect(tripService.archiveTrip).not.toHaveBeenCalled();
  });
});
