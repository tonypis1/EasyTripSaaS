import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const run = !!process.env.DATABASE_URL;

describe.skipIf(!run)("Prisma trip flow (integration)", () => {
  let userId: string;
  let tripId: string;

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: {
        clerkUserId: `int_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: `int_test_${Date.now()}@example.com`,
      },
    });
    userId = u.id;

    const start = new Date(Date.UTC(2026, 5, 1));
    const end = new Date(Date.UTC(2026, 5, 3));
    const access = new Date(Date.UTC(2026, 11, 31));

    const trip = await prisma.trip.create({
      data: {
        organizerId: userId,
        destination: "Roma",
        startDate: start,
        endDate: end,
        accessExpiresAt: access,
        tripType: "solo",
        status: "active",
      },
    });
    tripId = trip.id;

    const version = await prisma.tripVersion.create({
      data: {
        tripId,
        versionNum: 1,
        isActive: true,
        geoScore: 8,
      },
    });

    await prisma.day.create({
      data: {
        tripVersionId: version.id,
        dayNumber: 1,
        unlockDate: start,
        title: "Giorno 1",
        morning: JSON.stringify({ title: "Colosseo", place: "Roma" }),
        afternoon: JSON.stringify({ title: "Fori", place: "Roma" }),
        evening: JSON.stringify({ title: "Trastevere", place: "Roma" }),
      },
    });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("loads trip with versions and days", async () => {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        versions: { include: { days: true } },
      },
    });
    expect(trip?.destination).toBe("Roma");
    expect(trip?.versions).toHaveLength(1);
    expect(trip?.versions[0].days).toHaveLength(1);
    expect(trip?.versions[0].days[0].dayNumber).toBe(1);
  });

  it("query day by trip matches FK", async () => {
    const day = await prisma.day.findFirst({
      where: { tripVersion: { tripId } },
      include: { tripVersion: true },
    });
    expect(day?.tripVersion.tripId).toBe(tripId);
  });
});
