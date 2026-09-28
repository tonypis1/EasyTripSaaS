import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GroundedDestinationSchema } from "@/lib/grounding/grounding-schema";
import { VerifiedPoiCacheRepository } from "@/server/repositories/VerifiedPoiCacheRepository";

const run = !!process.env.DATABASE_URL;

const payload = {
  areas: [
    {
      name: "Centro Storico",
      attractions: [{ name: "Colosseo", kind: "monument", note: "n" }],
      restaurants: [{ name: "Trattoria Da Enzo", cuisine: "roman", note: "n" }],
    },
  ],
};

describe.skipIf(!run)("VerifiedPoiCacheRepository (integration)", () => {
  const repo = new VerifiedPoiCacheRepository();
  const key = `int-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    await prisma.verifiedPoiCache.deleteMany({
      where: { destinationKey: key },
    });
  });

  afterAll(async () => {
    await prisma.verifiedPoiCache.deleteMany({
      where: { destinationKey: key },
    });
    await prisma.$disconnect();
  });

  it("salva e rilegge il payload jsonb (round-trip) finché non è scaduto", async () => {
    const now = new Date("2026-09-28T12:00:00Z");
    await repo.upsert({
      destinationKey: key,
      destinationLabel: "Roma",
      payload,
      sources: [{ url: "https://it.wikipedia.org/wiki/Roma", title: "Roma" }],
      ttlDays: 30,
      now,
    });

    const hit = await repo.findFresh(key, new Date("2026-10-01T00:00:00Z"));

    expect(hit).not.toBeNull();
    expect(GroundedDestinationSchema.parse(hit?.payload)).toEqual(payload);
    expect(hit?.sources).toEqual([
      { url: "https://it.wikipedia.org/wiki/Roma", title: "Roma" },
    ]);
    expect(hit?.expiresAt).toEqual(new Date("2026-10-28T12:00:00Z"));
  });

  it("non ritorna la riga dopo la scadenza (TTL)", async () => {
    expect(
      await repo.findFresh(key, new Date("2026-10-29T00:00:00Z")),
    ).toBeNull();
  });

  it("il refresh sovrascrive la stessa riga (una sola riga per destinazione)", async () => {
    const later = new Date("2026-11-01T12:00:00Z");
    await repo.upsert({
      destinationKey: key,
      destinationLabel: "Roma (aggiornata)",
      payload: {
        areas: [{ ...payload.areas[0], name: "Trastevere" }],
      },
      sources: [],
      ttlDays: 30,
      now: later,
    });

    expect(
      await prisma.verifiedPoiCache.count({ where: { destinationKey: key } }),
    ).toBe(1);
    const refreshed = await repo.findFresh(key, later);
    expect(refreshed?.destinationLabel).toBe("Roma (aggiornata)");
    expect(
      GroundedDestinationSchema.parse(refreshed?.payload).areas[0].name,
    ).toBe("Trastevere");
  });
});
