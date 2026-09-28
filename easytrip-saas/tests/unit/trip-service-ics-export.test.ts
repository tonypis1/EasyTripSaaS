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

function slotJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: "Colosseo",
    place: "Rione Monti",
    why: "Simbolo di Roma",
    startTime: "09:00",
    endTime: "11:30",
    googleMapsQuery: "Colosseo Roma",
    lat: 41.8902,
    lng: 12.4922,
    tips: [],
    ...overrides,
  });
}

function baseTrip() {
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
    versions: [
      {
        versionNum: 1,
        geoScore: 8,
        generatedAt: new Date("2026-05-01"),
        isActive: true,
        days: [
          {
            id: "day1",
            dayNumber: 1,
            unlockDate: new Date("2026-06-01"),
            title: "Giorno 1",
            morning: slotJson({ title: "Colosseo" }),
            afternoon: slotJson({
              title: "Foro Romano",
              startTime: "14:00",
              endTime: "16:00",
            }),
            evening: null,
            restaurants: null,
            mapCenterLat: 41.89,
            mapCenterLng: 12.49,
            zoneFocus: "Centro",
            dowWarning: "",
            localGem: "",
            tips: "",
            proposals: [],
          },
        ],
      },
    ],
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
  mocks.creditAggregate.mockResolvedValue({ _sum: { amount: 0 } });
});

describe("TripService.getTripIcsExport", () => {
  it("genera un filename e un contenuto .ics a partire dai giorni del trip attivo", async () => {
    const service = makeService(vi.fn().mockResolvedValue(baseTrip()));

    const { filename, content } = await service.getTripIcsExport("trip1");

    expect(filename).toBe("easytrip-roma.ics");
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("SUMMARY:Colosseo");
    expect(content).toContain("SUMMARY:Foro Romano");
    expect(content).toContain("UID:day1-morning@easytripsaas.com");
    // Evening è null: nessun terzo evento per quello slot.
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("propaga l'errore TRIP_NOT_FOUND se il trip non esiste o non è visibile all'utente", async () => {
    const tripRepository = {
      findDetailForOrganizer: vi.fn().mockResolvedValue(null),
      findDetailForMember: vi.fn().mockResolvedValue(null),
    } as unknown as TripRepository;
    const authService = {
      getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user1" }),
    } as unknown as AuthService;
    const service = new TripService(authService, tripRepository);

    await expect(service.getTripIcsExport("trip1")).rejects.toMatchObject({
      code: "TRIP_NOT_FOUND",
      statusCode: 404,
    });
  });
});
