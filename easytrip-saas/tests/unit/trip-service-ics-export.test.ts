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

function slotFixture(overrides: Record<string, unknown> = {}) {
  return {
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
  };
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
            morning: slotFixture({ title: "Colosseo" }),
            afternoon: slotFixture({
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

describe("TripService.getTripDetail — slot jsonb nel DTO", () => {
  function tripWithDay(day: Record<string, unknown>) {
    const trip = baseTrip();
    trip.versions[0].days = [{ ...trip.versions[0].days[0], ...day }];
    return trip;
  }

  it("espone gli slot come oggetti già letti dal jsonb (il client non fa JSON.parse)", async () => {
    const service = makeService(vi.fn().mockResolvedValue(baseTrip()));

    const { days } = await service.getTripDetail("trip1");

    expect(days[0].morning).toMatchObject({
      title: "Colosseo",
      startTime: "09:00",
    });
    expect(days[0].afternoon).toMatchObject({ title: "Foro Romano" });
    expect(days[0].evening).toBeNull();
  });

  it("slot vuoti, illeggibili o non oggetto diventano null (mai un'eccezione)", async () => {
    for (const bad of [
      {},
      "",
      "null",
      "{non json",
      "testo libero",
      42,
      [1, 2],
    ]) {
      const service = makeService(
        vi.fn().mockResolvedValue(tripWithDay({ morning: bad })),
      );

      const { days } = await service.getTripDetail("trip1");

      expect(days[0].morning).toBeNull();
    }
  });

  it("legge anche uno slot ancora salvato come stringa JSON (riga non convertita)", async () => {
    const service = makeService(
      vi.fn().mockResolvedValue(
        tripWithDay({
          morning: JSON.stringify(slotFixture({ title: "Legacy" })),
        }),
      ),
    );

    const { days } = await service.getTripDetail("trip1");

    expect(days[0].morning).toMatchObject({ title: "Legacy" });
  });

  it("i ristoranti si leggono da un array jsonb, anche nel formato storico pre-A2", async () => {
    const service = makeService(
      vi.fn().mockResolvedValue(
        tripWithDay({
          restaurants: [
            {
              meal: "cena",
              name: "Da Enzo",
              cuisine: "romana",
              why: "Cacio e pepe",
              budgetHint: "€12-16",
              distance: "100m",
              reservationNeeded: true,
              reservationTip: "Prenota",
            },
          ],
        }),
      ),
    );
    const legacy = makeService(
      vi.fn().mockResolvedValue(
        tripWithDay({
          restaurants: [
            { name: "Uno", why: "Buono", budgetHint: "€10" },
            { name: "Due", why: "Ottimo", budgetHint: "€20" },
          ],
        }),
      ),
    );

    const current = (await service.getTripDetail("trip1")).days[0].restaurants;
    const old = (await legacy.getTripDetail("trip1")).days[0].restaurants;

    expect(current).toEqual([
      expect.objectContaining({ meal: "cena", name: "Da Enzo" }),
    ]);
    // Formato storico: 1° pranzo, 2° cena.
    expect(old?.map((r) => [r.name, r.meal])).toEqual([
      ["Uno", "pranzo"],
      ["Due", "cena"],
    ]);
  });

  it("senza ristoranti (colonna NULL) o con un valore non lista il DTO ha null", async () => {
    for (const value of [null, {}, "n/d"]) {
      const service = makeService(
        vi.fn().mockResolvedValue(tripWithDay({ restaurants: value })),
      );

      expect(
        (await service.getTripDetail("trip1")).days[0].restaurants,
      ).toBeNull();
    }
  });
});

describe("TripService.getTripDetail — preferenze strutturate", () => {
  it("espone le preferenze salvate sul viaggio", async () => {
    const trip = {
      ...baseTrip(),
      interests: ["history", "nature"],
      pace: "packed",
      mobilityNeeds: ["avoid_stairs"],
      dietaryRestrictions: ["vegan", "nut_allergy"],
    };
    const service = makeService(vi.fn().mockResolvedValue(trip));

    const { preferences } = await service.getTripDetail("trip1");

    expect(preferences).toEqual({
      interests: ["history", "nature"],
      pace: "packed",
      mobilityNeeds: ["avoid_stairs"],
      dietaryRestrictions: ["vegan", "nut_allergy"],
    });
  });

  it("viaggi precedenti alla funzione (campi assenti) → preferenze vuote, mai un errore", async () => {
    const service = makeService(vi.fn().mockResolvedValue(baseTrip()));

    const { preferences } = await service.getTripDetail("trip1");

    expect(preferences).toEqual({
      interests: [],
      pace: null,
      mobilityNeeds: [],
      dietaryRestrictions: [],
    });
  });

  it("ignora chiavi non più supportate salvate in passato", async () => {
    const trip = {
      ...baseTrip(),
      interests: ["history", "chiave_rimossa"],
      pace: "x",
    };
    const service = makeService(vi.fn().mockResolvedValue(trip));

    const { preferences } = await service.getTripDetail("trip1");

    expect(preferences.interests).toEqual(["history"]);
    expect(preferences.pace).toBeNull();
  });

  it("i ristoranti espongono dietaryFit (solo chiavi note; vuoto per i record precedenti)", async () => {
    const trip = baseTrip();
    (trip.versions[0].days[0] as Record<string, unknown>).restaurants = [
      {
        meal: "pranzo",
        name: "Verde",
        cuisine: "veg",
        why: "Buono",
        budgetHint: "€10",
        distance: "50m",
        reservationNeeded: false,
        reservationTip: "",
        dietaryFit: ["vegan", "chiave_sconosciuta", "gluten_free"],
      },
      {
        meal: "cena",
        name: "Vecchio",
        cuisine: "trattoria",
        why: "Buono",
        budgetHint: "€20",
        distance: "80m",
        reservationNeeded: false,
        reservationTip: "",
      },
    ];
    const service = makeService(vi.fn().mockResolvedValue(trip));

    const { days } = await service.getTripDetail("trip1");

    expect(days[0].restaurants?.map((r) => r.dietaryFit)).toEqual([
      ["vegan", "gluten_free"],
      [],
    ]);
  });
});
