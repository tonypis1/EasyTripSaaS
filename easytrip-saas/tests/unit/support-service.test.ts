import { describe, expect, it, vi } from "vitest";
import { SupportService } from "@/server/services/support/supportService";
import type { AuthService } from "@/server/services/auth/authService";
import type { SupportRepository } from "@/server/repositories/SupportRepository";
import type { TripRepository } from "@/server/repositories/TripRepository";

/**
 * createTicket accettava tripId dal client senza verificare che l'utente
 * fosse organizzatore/membro di quel trip: chiunque poteva agganciare un
 * ticket a un tripId altrui (indovinato/intercettato) e, riaprendo il
 * proprio ticket, vederne esposta la destinazione in toDto() — una fuga
 * minore di informazioni cross-tenant. Questi test bloccano il fix.
 */

function makeService(
  overrides: {
    supportRepo?: Record<string, unknown>;
    tripRepo?: Record<string, unknown>;
  } = {},
) {
  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user1" }),
  } as unknown as AuthService;

  const supportRepository = {
    createWithMessage: vi.fn().mockResolvedValue({
      id: "ticket1",
      subject: "Aiuto",
      channel: "in_app",
      status: "open",
      tripId: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      resolvedAt: null,
      trip: null,
      messages: [
        {
          id: "msg1",
          sender: "user",
          body: "Ho un problema",
          createdAt: new Date("2026-06-01T00:00:00Z"),
        },
      ],
    }),
    ...overrides.supportRepo,
  } as unknown as SupportRepository;

  const tripRepository = {
    isMember: vi.fn().mockResolvedValue(true),
    ...overrides.tripRepo,
  } as unknown as TripRepository;

  return {
    service: new SupportService(authService, supportRepository, tripRepository),
    supportRepository,
    tripRepository,
  };
}

describe("SupportService.createTicket — ownership del tripId", () => {
  it("crea il ticket senza tripId senza consultare la membership", async () => {
    const { service, tripRepository, supportRepository } = makeService();

    await service.createTicket({
      subject: "Aiuto",
      message: "Ho un problema",
      channel: "in_app",
    });

    expect(tripRepository.isMember).not.toHaveBeenCalled();
    expect(supportRepository.createWithMessage).toHaveBeenCalled();
  });

  it("lancia 403 NOT_MEMBER se l'utente non è membro/organizzatore del tripId indicato", async () => {
    const { service, supportRepository } = makeService({
      tripRepo: { isMember: vi.fn().mockResolvedValue(false) },
    });

    await expect(
      service.createTicket({
        tripId: "trip-altrui",
        subject: "Aiuto",
        message: "Ho un problema",
        channel: "in_app",
      }),
    ).rejects.toMatchObject({ code: "NOT_MEMBER", statusCode: 403 });

    expect(supportRepository.createWithMessage).not.toHaveBeenCalled();
  });

  it("crea il ticket quando l'utente è membro/organizzatore del trip indicato", async () => {
    const { service, tripRepository, supportRepository } = makeService();

    await service.createTicket({
      tripId: "trip1",
      subject: "Aiuto",
      message: "Ho un problema",
      channel: "in_app",
    });

    expect(tripRepository.isMember).toHaveBeenCalledWith("trip1", "user1");
    expect(supportRepository.createWithMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip1", userId: "user1" }),
    );
  });
});
