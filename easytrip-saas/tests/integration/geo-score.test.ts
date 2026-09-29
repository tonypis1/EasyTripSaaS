import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { TripRepository } from "@/server/repositories/TripRepository";
import { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import { GeoScoreService } from "@/server/services/trip/geoScoreService";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";

const run = !!process.env.DATABASE_URL;

function slot(title: string, lat: number | null, lng: number | null) {
  return {
    title,
    place: "Centro",
    why: "Bello",
    startTime: "10:00",
    endTime: "12:00",
    durationMin: 120,
    googleMapsQuery: `${title} Roma`,
    bookingLink: null,
    tips: ["Vai presto"],
    lat,
    lng,
  };
}

const COLOSSEO = slot("Colosseo", 41.8902, 12.4922);
const FORO = slot("Foro Romano", 41.8925, 12.4853);
const PANTHEON = slot("Pantheon", 41.8986, 12.4769);
// Alternativa lontanissima: la stessa mattina, ma a Versailles.
const VERSAILLES = slot("Reggia di Versailles", 48.8049, 2.1204);

describe.skipIf(!run)("GeoScore (integration)", () => {
  const tripRepository = new TripRepository();
  const geoScore = new GeoScoreService(tripRepository);
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let userId: string;
  let tripId: string;
  let versionId: string;
  let dayId: string;

  const stored = async () =>
    Number(
      (await prisma.tripVersion.findUniqueOrThrow({ where: { id: versionId } }))
        .geoScore,
    );

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        clerkUserId: `int_geo_${suffix}`,
        email: `int_geo_${suffix}@example.com`,
      },
    });
    userId = user.id;

    const trip = await prisma.trip.create({
      data: {
        organizerId: userId,
        destination: "Roma",
        startDate: new Date(Date.UTC(2026, 5, 1)),
        endDate: new Date(Date.UTC(2026, 5, 2)),
        accessExpiresAt: new Date(Date.UTC(2026, 11, 31)),
        tripType: "solo",
        status: "active",
      },
    });
    tripId = trip.id;
    await prisma.tripMember.create({
      data: { tripId, userId, role: "org" },
    });

    // geoScore 5.0 = valore "dichiarato dal modello" salvato alla generazione.
    const version = await prisma.tripVersion.create({
      data: { tripId, versionNum: 1, isActive: true, geoScore: 5 },
    });
    versionId = version.id;

    const day = await prisma.day.create({
      data: {
        tripVersionId: versionId,
        dayNumber: 1,
        unlockDate: new Date(Date.UTC(2026, 5, 1)),
        morning: JSON.stringify(COLOSSEO),
        afternoon: JSON.stringify(FORO),
        evening: JSON.stringify(PANTHEON),
      },
    });
    dayId = day.id;
  });

  afterAll(async () => {
    if (tripId) {
      await prisma.trip
        .delete({ where: { id: tripId } })
        .catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("findVersionDaySlots ritorna solo gli slot dei giorni della versione, in ordine", async () => {
    const days = await tripRepository.findVersionDaySlots(versionId);

    expect(days).toHaveLength(1);
    expect(Object.keys(days[0]).sort()).toEqual([
      "afternoon",
      "dayNumber",
      "evening",
      "morning",
    ]);
  });

  it("refreshForVersion sostituisce il punteggio dichiarato con quello calcolato dalle coordinate", async () => {
    expect(await stored()).toBe(5);

    const score = await geoScore.refreshForVersion(versionId);

    // Colosseo → Foro → Pantheon: ~1.6 km lineari, punteggio pieno.
    expect(score).toBeGreaterThanOrEqual(9.5);
    expect(await stored()).toBe(score);
  });

  it("dopo un'alternativa votata lontanissima il GeoScore scende (resolver reale + DB reale)", async () => {
    const before = await stored();

    const proposal = await prisma.slotProposal.create({
      data: {
        dayId,
        slotKey: "morning",
        status: "open",
        openedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
        options: [
          { slot: COLOSSEO, distance: null, note: null },
          { slot: VERSAILLES, distance: "20km", note: "Fuori città" },
        ],
      },
    });

    const repo = new SlotProposalRepository();
    const resolver = new SlotProposalResolver(repo, geoScore);
    const loaded = await repo.findWithContext(proposal.id);
    if (!loaded) throw new Error("proposta non trovata");

    expect(await resolver.finalize(loaded, 1)).toBe(true);

    const day = await prisma.day.findUniqueOrThrow({ where: { id: dayId } });
    expect(JSON.parse(day.morning ?? "{}").title).toBe("Reggia di Versailles");
    // Mattina a Versailles + pomeriggio/sera a Roma: tratta di ~1400 km.
    expect(await stored()).toBeLessThan(before - 3);
  });

  it("mantenere lo slot attuale non tocca il punteggio", async () => {
    const before = await stored();

    const proposal = await prisma.slotProposal.create({
      data: {
        dayId,
        slotKey: "evening",
        status: "open",
        openedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
        options: [
          { slot: PANTHEON, distance: null, note: null },
          { slot: COLOSSEO, distance: "1km", note: null },
        ],
      },
    });
    const repo = new SlotProposalRepository();
    const resolver = new SlotProposalResolver(repo, geoScore);
    const loaded = await repo.findWithContext(proposal.id);
    if (!loaded) throw new Error("proposta non trovata");

    await resolver.finalize(loaded, 0);

    expect(await stored()).toBe(before);
  });

  it("senza coordinate sufficienti il punteggio esistente resta com'è", async () => {
    await prisma.day.update({
      where: { id: dayId },
      data: {
        morning: JSON.stringify(slot("Mattina libera", null, null)),
        afternoon: JSON.stringify(slot("Pomeriggio libero", null, null)),
        evening: JSON.stringify(slot("Serata libera", null, null)),
      },
    });
    const before = await stored();

    expect(await geoScore.refreshForVersion(versionId)).toBeNull();
    expect(await stored()).toBe(before);
  });
});
