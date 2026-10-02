import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dayContentForDb } from "@/lib/trip/day-slots";
import type { DaySlot } from "@/lib/itinerary-model-schema";

const prisma = new PrismaClient();
const run = !!process.env.DATABASE_URL;

describe.skipIf(!run)("Prisma trip flow (integration)", () => {
  let userId: string;
  let tripId: string;
  let versionId: string;

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

    versionId = version.id;

    // Slot e ristoranti sono jsonb: si scrivono come oggetti.
    await prisma.day.create({
      data: {
        tripVersionId: version.id,
        dayNumber: 1,
        unlockDate: start,
        title: "Giorno 1",
        morning: { title: "Colosseo", place: "Roma", tips: ["Presto"] },
        afternoon: { title: "Fori", place: "Roma" },
        evening: { title: "Trastevere", place: "Roma" },
        restaurants: [
          { meal: "pranzo", name: "Da Enzo", reservationNeeded: true },
          { meal: "cena", name: "Roscioli", reservationNeeded: false },
        ],
      },
    });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
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

  it("legge slot e ristoranti come oggetti/array, senza JSON.parse", async () => {
    const day = await prisma.day.findFirstOrThrow({
      where: { tripVersion: { tripId }, dayNumber: 1 },
    });

    expect(day.morning).toEqual({
      title: "Colosseo",
      place: "Roma",
      tips: ["Presto"],
    });
    expect(day.afternoon).toEqual({ title: "Fori", place: "Roma" });
    expect(day.restaurants).toEqual([
      { meal: "pranzo", name: "Da Enzo", reservationNeeded: true },
      { meal: "cena", name: "Roscioli", reservationNeeded: false },
    ]);
  });

  it("sono salvati come veri jsonb (non come stringhe JSON doppiamente serializzate)", async () => {
    const [row] = await prisma.$queryRaw<
      {
        morning: string;
        afternoon: string;
        evening: string;
        restaurants: string;
      }[]
    >`SELECT jsonb_typeof("morning") AS morning,
             jsonb_typeof("afternoon") AS afternoon,
             jsonb_typeof("evening") AS evening,
             jsonb_typeof("restaurants") AS restaurants
      FROM "Day"
      WHERE "trip_version_id" = ${versionId} AND "day_number" = 1`;

    expect(row).toEqual({
      morning: "object",
      afternoon: "object",
      evening: "object",
      restaurants: "array",
    });
  });

  it("i campi jsonb sono interrogabili: filtro su un attributo dello slot", async () => {
    const found = await prisma.day.findMany({
      where: {
        tripVersionId: versionId,
        morning: { path: ["title"], equals: "Colosseo" },
      },
    });
    const notFound = await prisma.day.findMany({
      where: {
        tripVersionId: versionId,
        morning: { path: ["title"], equals: "Pantheon" },
      },
    });

    expect(found).toHaveLength(1);
    expect(notFound).toHaveLength(0);
  });

  it("dayContentForDb (percorso di generazione) salva oggetti jsonb e un segnaposto per gli slot mancanti", async () => {
    const slot: DaySlot = {
      title: "Pantheon",
      place: "Centro",
      why: "Bello",
      startTime: "09:00",
      endTime: "10:30",
      durationMin: 90,
      googleMapsQuery: "Pantheon Roma",
      bookingLink: null,
      tips: ["Presto"],
      lat: 41.8986,
      lng: 12.4769,
    };
    const created = await prisma.day.create({
      data: {
        tripVersionId: versionId,
        dayNumber: 2,
        unlockDate: new Date(Date.UTC(2026, 5, 2)),
        ...dayContentForDb({ morning: slot, afternoon: null, evening: null }),
      },
    });

    const day = await prisma.day.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(day.morning).toEqual(slot);
    expect(day.afternoon).toMatchObject({
      title: "Pomeriggio libero",
      lat: null,
    });
    expect(day.restaurants).toBeNull(); // nessun ristorante: colonna NULL, non "null" né []

    const [row] = await prisma.$queryRaw<
      { morning: string; afternoon: string }[]
    >`
      SELECT jsonb_typeof("morning") AS morning, jsonb_typeof("afternoon") AS afternoon
      FROM "Day" WHERE "id" = ${created.id}`;
    expect(row).toEqual({ morning: "object", afternoon: "object" });
  });

  it("query day by trip matches FK", async () => {
    const day = await prisma.day.findFirst({
      where: { tripVersion: { tripId } },
      include: { tripVersion: true },
    });
    expect(day?.tripVersion.tripId).toBe(tripId);
  });
});
