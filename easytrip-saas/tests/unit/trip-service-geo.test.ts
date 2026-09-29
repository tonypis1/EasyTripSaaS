import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  creditAggregate: vi.fn(),
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
  },
}));

import { TripService } from "@/server/services/trip/tripService";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

const slot = (lat: number | null, lng: number | null) =>
  JSON.stringify({ title: "Tappa", lat, lng });

const COLOSSEO = [41.8902, 12.4922] as const;
const FORO = [41.8925, 12.4853] as const;
const PANTHEON = [41.8986, 12.4769] as const;

function day(
  dayNumber: number,
  points: (readonly [number, number] | null)[],
): Record<string, unknown> {
  const [morning, afternoon, evening] = points.map((p) =>
    p ? slot(p[0], p[1]) : null,
  );
  return {
    id: `day${dayNumber}`,
    dayNumber,
    unlockDate: new Date("2026-06-01"),
    title: `Giorno ${dayNumber}`,
    morning,
    afternoon,
    evening,
    restaurants: null,
    mapCenterLat: 41.89,
    mapCenterLng: 12.49,
    zoneFocus: "Centro",
    dowWarning: "",
    localGem: "",
    tips: "",
    proposals: [],
  };
}

function trip(versions: Record<string, unknown>[]) {
  return {
    id: "trip1",
    organizerId: "user1",
    destination: "Roma",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-02"),
    accessExpiresAt: new Date("2026-07-01"),
    tripType: "solo",
    style: null,
    budgetLevel: "moderate",
    status: "active",
    regenCount: 0,
    currentVersion: 1,
    localPassCityCount: 0,
    inviteToken: "tok",
    amountPaid: 3.99,
    prefChangedAfterGen: false,
    members: [],
    versions,
  };
}

const version = (
  overrides: Record<string, unknown>,
  days: Record<string, unknown>[],
) => ({
  versionNum: 1,
  geoScore: 6,
  generatedAt: new Date("2026-05-01"),
  isActive: true,
  days,
  ...overrides,
});

function makeService(detail: unknown) {
  const tripRepository = {
    findDetailForOrganizer: vi.fn().mockResolvedValue(detail),
    findDetailForMember: vi.fn(),
  } as unknown as TripRepository;
  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user1" }),
  } as unknown as AuthService;
  return new TripService(authService, tripRepository);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.creditAggregate.mockResolvedValue({ _sum: { amount: 0 } });
});

describe("TripService.getTripDetail — GeoScore calcolato", () => {
  it("usa il punteggio calcolato dalle coordinate, non quello salvato (dichiarato dal modello)", async () => {
    const service = makeService(
      trip([version({}, [day(1, [COLOSSEO, FORO, PANTHEON])])]),
    );

    const detail = await service.getTripDetail("trip1");

    expect(detail.activeGeoScore).toBeGreaterThan(9.5);
    expect(detail.activeGeoScore).not.toBe(6);
    // Il carosello mostra lo stesso numero dell'header per la versione attiva.
    expect(detail.versions[0].geoScore).toBe(detail.activeGeoScore);
  });

  it("espone l'analisi per giorno (km, riordino) per la UI", async () => {
    const service = makeService(
      trip([
        version({}, [
          day(1, [COLOSSEO, FORO, PANTHEON]),
          // Zig-zag Colosseo → Vaticano → Foro
          day(2, [COLOSSEO, [41.9065, 12.4536], FORO]),
        ]),
      ]),
    );

    const { geo } = await service.getTripDetail("trip1");

    expect(geo?.scoredDays).toBe(2);
    expect(geo?.days[0]).toMatchObject({
      dayNumber: 1,
      isOrderImprovable: false,
    });
    expect(geo?.days[1]).toMatchObject({
      dayNumber: 2,
      isOrderImprovable: true,
      bestOrder: ["morning", "evening", "afternoon"],
    });
    expect(geo?.avoidableKm).toBeCloseTo(3.05, 1);
  });

  it("ripiega sul punteggio salvato quando le coordinate non bastano", async () => {
    const service = makeService(
      trip([version({ geoScore: 7.5 }, [day(1, [COLOSSEO, null, null])])]),
    );

    const detail = await service.getTripDetail("trip1");

    expect(detail.activeGeoScore).toBe(7.5);
    expect(detail.geo).toBeNull();
    expect(detail.versions[0].geoScore).toBe(7.5);
  });

  it("le versioni non attive (senza giorni caricati) restano col punteggio salvato", async () => {
    const service = makeService(
      trip([
        version({ versionNum: 1, isActive: false, geoScore: 5.5 }, []),
        version({ versionNum: 2, isActive: true, geoScore: 6 }, [
          day(1, [COLOSSEO, FORO, PANTHEON]),
        ]),
      ]),
    );

    const detail = await service.getTripDetail("trip1");

    expect(detail.versions.find((v) => v.versionNum === 1)?.geoScore).toBe(5.5);
    expect(detail.versions.find((v) => v.versionNum === 2)?.geoScore).toBe(
      detail.activeGeoScore,
    );
  });

  it("senza versione attiva non c'è né punteggio né analisi", async () => {
    const service = makeService(
      trip([version({ isActive: false, geoScore: 5 }, [])]),
    );

    const detail = await service.getTripDetail("trip1");

    expect(detail.activeGeoScore).toBeNull();
    expect(detail.geo).toBeNull();
  });
});

describe("TripService.getShareCardData — GeoScore calcolato", () => {
  it("la card di condivisione mostra lo stesso punteggio dell'header", async () => {
    const service = makeService(
      trip([version({}, [day(1, [COLOSSEO, FORO, PANTHEON])])]),
    );

    const card = await service.getShareCardData("trip1");
    const detail = await service.getTripDetail("trip1");

    expect(card.geoScore).toBe(detail.activeGeoScore);
    expect(card.geoScore).toBeGreaterThan(9.5);
  });

  it("ripiega sul salvato, e senza nemmeno quello risponde GEOSCORE_NOT_READY", async () => {
    const stored = makeService(
      trip([version({ geoScore: 7 }, [day(1, [null, null, null])])]),
    );
    expect((await stored.getShareCardData("trip1")).geoScore).toBe(7);

    const none = makeService(
      trip([version({ geoScore: null }, [day(1, [null, null, null])])]),
    );
    await expect(none.getShareCardData("trip1")).rejects.toMatchObject({
      code: "GEOSCORE_NOT_READY",
      statusCode: 422,
    });
  });
});
