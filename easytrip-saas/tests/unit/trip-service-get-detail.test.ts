import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getTripDetail faceva: fetch dettaglio -> sync nomi membri da Clerk (una
 * chiamata per membro, in sequenza, ad ogni caricamento pagina) -> un
 * secondo fetch dettaglio identico solo per rileggere gli eventuali nomi
 * aggiornati. Questi test bloccano il fix: una sola query di dettaglio,
 * throttle via `User.clerkNameSyncedAt` (i membri già sincronizzati di
 * recente non richiamano Clerk), chiamate Clerk in parallelo per i membri
 * scaduti, e nomi aggiornati applicati in memoria senza un secondo giro sul DB.
 */

const mocks = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  clerkGetUser: vi.fn(),
  userUpdate: vi.fn(),
  creditAggregate: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: mocks.clerkClient,
}));

vi.mock("@/config/unifiedConfig", () => ({
  config: {
    app: { baseUrl: "https://easytripsaas.com" },
    billing: {
      priceGroupCents: 699,
      priceSoloCoupleCents: 399,
      priceLocalPassCents: 399,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    credit: { aggregate: mocks.creditAggregate },
    user: { update: mocks.userUpdate },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

import { TripService } from "@/server/services/trip/tripService";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

function member(overrides: {
  id?: string;
  role?: string;
  balance?: number;
  totalPaid?: number;
  user?: Partial<{
    id: string;
    name: string | null;
    email: string;
    clerkUserId: string;
    clerkNameSyncedAt: Date | null;
  }>;
} = {}) {
  const { user: userOverrides, ...rest } = overrides;
  return {
    id: "member1",
    role: "member",
    balance: 0,
    totalPaid: 0,
    ...rest,
    user: {
      id: "user1",
      name: "Vecchio Nome",
      email: "a@example.com",
      clerkUserId: "clerk_user1",
      clerkNameSyncedAt: null,
      ...userOverrides,
    },
  };
}

function baseTrip(members: ReturnType<typeof member>[]) {
  return {
    id: "trip1",
    organizerId: "user1",
    destination: "Roma",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-05"),
    accessExpiresAt: new Date("2026-07-01"),
    tripType: "gruppo",
    style: null,
    budgetLevel: "moderate",
    status: "active",
    regenCount: 1,
    currentVersion: 1,
    localPassCityCount: 0,
    inviteToken: "tok",
    amountPaid: 6.99,
    prefChangedAfterGen: false,
    versions: [],
    members,
  };
}

function makeService(findDetailForOrganizer: ReturnType<typeof vi.fn>) {
  const tripRepository = {
    findDetailForOrganizer,
    findDetailForMember: vi.fn(),
  } as unknown as TripRepository;

  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user1" }),
  } as unknown as AuthService;

  return new TripService(authService, tripRepository);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.clerkClient.mockResolvedValue({ users: { getUser: mocks.clerkGetUser } });
  mocks.creditAggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mocks.userUpdate.mockResolvedValue({});
});

describe("TripService.getTripDetail — niente doppio fetch", () => {
  it("fa una sola query di dettaglio, anche quando c'è un membro da risincronizzare", async () => {
    const m = member();
    const findDetailForOrganizer = vi.fn().mockResolvedValue(baseTrip([m]));
    mocks.clerkGetUser.mockResolvedValue({
      firstName: "Nuovo",
      lastName: "Nome",
    });

    const service = makeService(findDetailForOrganizer);
    const detail = await service.getTripDetail("trip1");

    expect(findDetailForOrganizer).toHaveBeenCalledTimes(1);
    expect(detail.members[0].name).toBe("Nuovo Nome");
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { name: "Nuovo Nome", clerkNameSyncedAt: expect.any(Date) },
    });
  });

  it("non richiama Clerk per un membro già sincronizzato di recente (throttle)", async () => {
    const fresh = member({
      user: { clerkNameSyncedAt: new Date() },
    });
    const findDetailForOrganizer = vi.fn().mockResolvedValue(baseTrip([fresh]));

    const service = makeService(findDetailForOrganizer);
    const detail = await service.getTripDetail("trip1");

    expect(mocks.clerkGetUser).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(detail.members[0].name).toBe("Vecchio Nome");
  });

  it("non tocca clerkNameSyncedAt se Clerk fallisce, e lascia il nome invariato (permette retry al giro successivo)", async () => {
    const m = member();
    const findDetailForOrganizer = vi.fn().mockResolvedValue(baseTrip([m]));
    mocks.clerkGetUser.mockRejectedValue(new Error("Clerk down"));

    const service = makeService(findDetailForOrganizer);
    const detail = await service.getTripDetail("trip1");

    expect(detail.members[0].name).toBe("Vecchio Nome");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("interroga Clerk in parallelo per più membri scaduti, non uno alla volta in sequenza", async () => {
    const memberA = member({
      id: "memberA",
      user: { id: "userA", clerkUserId: "clerk_a", name: "A" },
    });
    const memberB = member({
      id: "memberB",
      user: { id: "userB", clerkUserId: "clerk_b", name: "B" },
    });
    const findDetailForOrganizer = vi
      .fn()
      .mockResolvedValue(baseTrip([memberA, memberB]));

    // clerk_a resta in attesa finché clerk_b non è stato invocato: con un
    // ciclo sequenziale (await uno alla volta) questo non accade mai e il
    // test va in timeout; con Promise.all le due chiamate partono insieme.
    let resolveBStarted: () => void;
    const bStarted = new Promise<void>((resolve) => {
      resolveBStarted = resolve;
    });
    mocks.clerkGetUser.mockImplementation(async (clerkUserId: string) => {
      if (clerkUserId === "clerk_a") {
        await bStarted;
      } else {
        resolveBStarted();
      }
      return { firstName: clerkUserId, lastName: "X" };
    });

    const service = makeService(findDetailForOrganizer);
    const result = await Promise.race([
      service.getTripDetail("trip1"),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("timeout: le chiamate Clerk sembrano sequenziali")),
          500,
        ),
      ),
    ]);

    expect(mocks.clerkGetUser).toHaveBeenCalledTimes(2);
    expect((result as { members: { name: string | null }[] }).members).toHaveLength(2);
  });
});
