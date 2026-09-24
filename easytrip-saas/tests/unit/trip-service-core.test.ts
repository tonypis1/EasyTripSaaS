import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Copre i metodi di TripService non ancora testati (createTrip, guard clause
 * di requestItineraryGeneration, updatePreferences, setActiveTripVersion,
 * joinTripByToken) — prima di questi test, oltre a getTripDetail, il resto
 * del service era privo di copertura.
 */

const mocks = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  inngestSend: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: mocks.clerkClient,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tripMember: { findMany: vi.fn() },
  },
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    app: { baseUrl: "https://easytripsaas.com", env: "production" },
    billing: {
      priceGroupCents: 699,
      priceSoloCoupleCents: 399,
      priceLocalPassCents: 399,
    },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock("@/lib/email/transactional", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/email/transactional")>();
  return { ...actual, sendTransactionalEmail: mocks.sendTransactionalEmail };
});

import { TripService } from "@/server/services/trip/tripService";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

function makeService(
  tripRepoOverrides: Record<string, unknown> = {},
  authOverrides: Record<string, unknown> = {},
) {
  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({
      id: "user1",
      email: "user1@example.com",
      language: "it",
    }),
    ...authOverrides,
  } as unknown as AuthService;

  const tripRepository = {
    ...tripRepoOverrides,
  } as unknown as TripRepository;

  return {
    service: new TripService(authService, tripRepository),
    tripRepository,
    authService,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.clerkClient.mockResolvedValue({ users: { getUser: vi.fn() } });
});

describe("TripService.createTrip", () => {
  it("lancia 400 INVALID_DATE_RANGE se endDate precede startDate", async () => {
    const { service } = makeService();

    await expect(
      service.createTrip({
        destination: "Roma",
        startDate: new Date("2026-06-05"),
        endDate: new Date("2026-06-01"),
        tripType: "solo",
        budgetLevel: "moderate",
      } as never),
    ).rejects.toMatchObject({ code: "INVALID_DATE_RANGE", statusCode: 400 });
  });

  it("crea il trip per l'utente corrente", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "trip1",
      status: "pending",
      destination: "Roma",
      tripType: "solo",
      budgetLevel: "moderate",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-05"),
      accessExpiresAt: new Date("2026-06-06"),
    });
    const { service } = makeService({ create });

    const result = await service.createTrip({
      destination: "Roma",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-05"),
      tripType: "solo",
      budgetLevel: "moderate",
    } as never);

    expect(result.id).toBe("trip1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ organizerId: "user1", destination: "Roma" }),
    );
  });
});

describe("TripService.requestItineraryGeneration", () => {
  function trip(overrides: Record<string, unknown> = {}) {
    return {
      id: "trip1",
      amountPaid: 3.99,
      regenCount: 1,
      ...overrides,
    };
  }

  it("lancia 404 se il trip non appartiene all'utente", async () => {
    const { service } = makeService({
      findByIdAndOrganizer: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.requestItineraryGeneration("trip1"),
    ).rejects.toMatchObject({ code: "TRIP_NOT_FOUND", statusCode: 404 });
  });

  it("lancia 402 PAYMENT_REQUIRED se il trip non è pagato (fuori sviluppo)", async () => {
    const { service } = makeService({
      findByIdAndOrganizer: vi
        .fn()
        .mockResolvedValue(trip({ amountPaid: null })),
    });

    await expect(
      service.requestItineraryGeneration("trip1"),
    ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED", statusCode: 402 });
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("lancia 400 REGEN_MAX_VERSIONS al raggiungimento del limite di versioni", async () => {
    const { service } = makeService({
      // regenCount=7 -> nextVersionNum=8 > MAX_TRIP_VERSION(7)
      findByIdAndOrganizer: vi.fn().mockResolvedValue(trip({ regenCount: 7 })),
    });

    await expect(
      service.requestItineraryGeneration("trip1"),
    ).rejects.toMatchObject({ code: "REGEN_MAX_VERSIONS", statusCode: 400 });
  });

  it("lancia 402 REGEN_PAYMENT_REQUIRED per le rigenerazioni a pagamento (versioni 5-7)", async () => {
    const { service } = makeService({
      // regenCount=4 -> nextVersionNum=5 (a pagamento)
      findByIdAndOrganizer: vi.fn().mockResolvedValue(trip({ regenCount: 4 })),
    });

    await expect(
      service.requestItineraryGeneration("trip1"),
    ).rejects.toMatchObject({
      code: "REGEN_PAYMENT_REQUIRED",
      statusCode: 402,
    });
  });

  it("innesca trip/generate.requested quando tutte le condizioni sono soddisfatte", async () => {
    const { service } = makeService({
      findByIdAndOrganizer: vi.fn().mockResolvedValue(trip()),
    });

    const result = await service.requestItineraryGeneration("trip1");

    expect(result).toEqual({ ok: true });
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "trip/generate.requested",
      data: { tripId: "trip1" },
    });
  });
});

describe("TripService.updatePreferences", () => {
  it("lancia 404 se il trip non viene aggiornato (non trovato/non organizzatore)", async () => {
    const { service } = makeService({
      updatePreferences: vi.fn().mockResolvedValue({ updated: false }),
    });

    await expect(
      service.updatePreferences("trip1", { budgetLevel: "premium" }),
    ).rejects.toMatchObject({ code: "TRIP_NOT_FOUND", statusCode: 404 });
  });

  it("aggiorna le preferenze con successo", async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ updated: true });
    const { service } = makeService({ updatePreferences });

    const result = await service.updatePreferences("trip1", {
      style: "foodie",
      budgetLevel: "premium",
    });

    expect(result).toEqual({ ok: true });
    expect(updatePreferences).toHaveBeenCalledWith("trip1", "user1", {
      style: "foodie",
      budgetLevel: "premium",
    });
  });
});

describe("TripService.setActiveTripVersion", () => {
  it("lancia 404 TRIP_NOT_FOUND quando il trip non esiste", async () => {
    const { service } = makeService({
      setActiveVersion: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "not_found" }),
    });

    await expect(
      service.setActiveTripVersion("trip1", 2),
    ).rejects.toMatchObject({ code: "TRIP_NOT_FOUND", statusCode: 404 });
  });

  it("lancia 404 VERSION_NOT_FOUND quando la versione non esiste", async () => {
    const { service } = makeService({
      setActiveVersion: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "version_not_found" }),
    });

    await expect(
      service.setActiveTripVersion("trip1", 9),
    ).rejects.toMatchObject({ code: "VERSION_NOT_FOUND", statusCode: 404 });
  });

  it("imposta la versione attiva con successo", async () => {
    const { service } = makeService({
      setActiveVersion: vi.fn().mockResolvedValue({ ok: true }),
    });

    await expect(service.setActiveTripVersion("trip1", 2)).resolves.toEqual({
      ok: true,
    });
  });
});

describe("TripService.joinTripByToken", () => {
  function inviteTrip(overrides: Record<string, unknown> = {}) {
    return {
      id: "trip1",
      tripType: "gruppo",
      destination: "Roma",
      members: [],
      organizer: { name: "Org", email: "org@example.com", language: "it" },
      ...overrides,
    };
  }

  it("lancia 404 INVITE_NOT_FOUND per un token non valido", async () => {
    const { service } = makeService({
      findByInviteToken: vi.fn().mockResolvedValue(null),
    });

    await expect(service.joinTripByToken("bad-token")).rejects.toMatchObject({
      code: "INVITE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("ritorna alreadyMember senza aggiungere un membro duplicato", async () => {
    const addMember = vi.fn();
    const { service } = makeService({
      findByInviteToken: vi.fn().mockResolvedValue(inviteTrip()),
      isMember: vi.fn().mockResolvedValue(true),
      addMember,
    });

    const result = await service.joinTripByToken("tok");

    expect(result).toEqual({ tripId: "trip1", alreadyMember: true });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("lancia 400 GROUP_FULL oltre il limite di 2 partecipanti per i viaggi di coppia", async () => {
    const { service } = makeService({
      findByInviteToken: vi.fn().mockResolvedValue(
        inviteTrip({
          tripType: "coppia",
          members: [{ id: "m1" }, { id: "m2" }],
        }),
      ),
      isMember: vi.fn().mockResolvedValue(false),
    });

    await expect(service.joinTripByToken("tok")).rejects.toMatchObject({
      code: "GROUP_FULL",
      statusCode: 400,
    });
  });

  it("lancia 400 GROUP_FULL oltre il limite di 5 partecipanti per i viaggi di gruppo", async () => {
    const { service } = makeService({
      findByInviteToken: vi.fn().mockResolvedValue(
        inviteTrip({
          members: [
            { id: "m1" },
            { id: "m2" },
            { id: "m3" },
            { id: "m4" },
            { id: "m5" },
          ],
        }),
      ),
      isMember: vi.fn().mockResolvedValue(false),
    });

    await expect(service.joinTripByToken("tok")).rejects.toMatchObject({
      code: "GROUP_FULL",
      statusCode: 400,
    });
  });

  it("aggiunge il nuovo membro quando c'è posto", async () => {
    const addMember = vi.fn().mockResolvedValue({});
    const { service } = makeService({
      findByInviteToken: vi
        .fn()
        .mockResolvedValue(inviteTrip({ members: [{ id: "m1" }] })),
      isMember: vi.fn().mockResolvedValue(false),
      addMember,
    });

    const result = await service.joinTripByToken("tok");

    expect(result).toEqual({ tripId: "trip1", alreadyMember: false });
    expect(addMember).toHaveBeenCalledWith("trip1", "user1");
  });
});
