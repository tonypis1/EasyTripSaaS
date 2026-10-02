import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verifiedPoiCache: { findFirst: mocks.findFirst, upsert: mocks.upsert },
  },
}));

import { VerifiedPoiCacheRepository } from "@/server/repositories/VerifiedPoiCacheRepository";

const payload = {
  areas: [
    {
      name: "Centro",
      attractions: [{ name: "Colosseo", kind: "", note: "" }],
      restaurants: [],
    },
  ],
};

beforeEach(() => {
  mocks.findFirst.mockReset();
  mocks.upsert.mockReset();
});

describe("VerifiedPoiCacheRepository", () => {
  it("findFresh legge solo righe non scadute (expiresAt > now)", async () => {
    const now = new Date("2026-09-28T12:00:00Z");
    await new VerifiedPoiCacheRepository().findFresh("roma", now);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { destinationKey: "roma", expiresAt: { gt: now } },
    });
  });

  it("upsert calcola la scadenza dal TTL e sovrascrive la riga al refresh", async () => {
    const now = new Date("2026-09-28T12:00:00Z");

    await new VerifiedPoiCacheRepository().upsert({
      destinationKey: "roma",
      destinationLabel: "Roma",
      payload,
      sources: [{ url: "https://example.com", title: "x" }],
      ttlDays: 30,
      now,
    });

    const args = mocks.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ destinationKey: "roma" });
    expect(args.create.destinationKey).toBe("roma");
    expect(args.create.expiresAt).toEqual(new Date("2026-10-28T12:00:00Z"));
    expect(args.update.fetchedAt).toEqual(now);
    expect(args.update.expiresAt).toEqual(args.create.expiresAt);
    expect(args.update.payload).toEqual(payload);
  });
});
