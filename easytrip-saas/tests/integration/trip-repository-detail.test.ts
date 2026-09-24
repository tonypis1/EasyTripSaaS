import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { TripRepository } from "@/server/repositories/TripRepository";

const prisma = new PrismaClient();
const run = !!process.env.DATABASE_URL;

/**
 * findDetailForOrganizer/ForMember univano in un solo `include` i `days` di
 * OGNI TripVersion, incluse quelle rigenerate e mai più mostrate (over-fetch).
 * Questo test verifica contro un DB reale che il fix mantenga il carosello
 * (tutte le versioni con i metadati) caricando i `days` solo per la versione
 * attiva.
 */
describe.skipIf(!run)("TripRepository detail queries (integration)", () => {
  const repo = new TripRepository();
  let organizerId: string;
  let memberId: string;
  let tripId: string;
  let oldVersionId: string;
  let activeVersionId: string;

  beforeAll(async () => {
    const organizer = await prisma.user.create({
      data: {
        clerkUserId: `int_org_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: `int_org_${Date.now()}@example.com`,
      },
    });
    organizerId = organizer.id;

    const member = await prisma.user.create({
      data: {
        clerkUserId: `int_mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: `int_mem_${Date.now()}@example.com`,
      },
    });
    memberId = member.id;

    const start = new Date(Date.UTC(2026, 5, 1));
    const end = new Date(Date.UTC(2026, 5, 3));
    const access = new Date(Date.UTC(2026, 11, 31));

    const trip = await prisma.trip.create({
      data: {
        organizerId,
        destination: "Roma",
        startDate: start,
        endDate: end,
        accessExpiresAt: access,
        tripType: "solo",
        status: "active",
        members: { create: { userId: organizerId, role: "org" } },
      },
    });
    tripId = trip.id;
    await prisma.tripMember.create({
      data: { tripId, userId: memberId, role: "member" },
    });

    const oldVersion = await prisma.tripVersion.create({
      data: { tripId, versionNum: 1, isActive: false, geoScore: 7 },
    });
    oldVersionId = oldVersion.id;
    await prisma.day.create({
      data: {
        tripVersionId: oldVersionId,
        dayNumber: 1,
        unlockDate: start,
        morning: "OLD_VERSION_SHOULD_NOT_BE_RETURNED",
      },
    });

    const activeVersion = await prisma.tripVersion.create({
      data: { tripId, versionNum: 2, isActive: true, geoScore: 9 },
    });
    activeVersionId = activeVersion.id;
    await prisma.day.create({
      data: {
        tripVersionId: activeVersionId,
        dayNumber: 1,
        unlockDate: start,
        morning: "ACTIVE_VERSION_DAY",
      },
    });
  });

  afterAll(async () => {
    if (tripId)
      await prisma.trip
        .delete({ where: { id: tripId } })
        .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [organizerId, memberId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("findDetailForOrganizer: mantiene tutte le versioni per il carosello, ma i giorni solo per quella attiva", async () => {
    const trip = await repo.findDetailForOrganizer(tripId, organizerId);

    expect(trip?.versions).toHaveLength(2);
    const versionNums = trip?.versions.map((v) => v.versionNum).sort();
    expect(versionNums).toEqual([1, 2]);

    const active = trip?.versions.find((v) => v.isActive);
    const old = trip?.versions.find((v) => !v.isActive);

    expect(active?.days).toHaveLength(1);
    expect(active?.days[0].morning).toBe("ACTIVE_VERSION_DAY");
    expect(old?.days).toHaveLength(0);

    expect(trip?.members).toHaveLength(2);
  });

  it("findDetailForMember: stesso comportamento per un membro non organizzatore", async () => {
    const trip = await repo.findDetailForMember(tripId, memberId);

    expect(trip?.versions).toHaveLength(2);
    const active = trip?.versions.find((v) => v.isActive);
    const old = trip?.versions.find((v) => !v.isActive);

    expect(active?.days).toHaveLength(1);
    expect(active?.days[0].morning).toBe("ACTIVE_VERSION_DAY");
    expect(old?.days).toHaveLength(0);
  });

  it("findDetailForMember: ritorna null per un utente che non è membro", async () => {
    const stranger = await prisma.user.create({
      data: {
        clerkUserId: `int_stranger_${Date.now()}`,
        email: `int_stranger_${Date.now()}@example.com`,
      },
    });

    const trip = await repo.findDetailForMember(tripId, stranger.id);
    expect(trip).toBeNull();

    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
