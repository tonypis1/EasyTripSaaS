import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  GroundedDestination,
  GroundingSource,
} from "@/lib/grounding/grounding-schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export class VerifiedPoiCacheRepository {
  /** La riga della destinazione solo se non è scaduta. */
  async findFresh(destinationKey: string, now = new Date()) {
    return prisma.verifiedPoiCache.findFirst({
      where: { destinationKey, expiresAt: { gt: now } },
    });
  }

  /** Una riga per destinazione: al refresh viene sovrascritta. */
  async upsert(input: {
    destinationKey: string;
    destinationLabel: string;
    payload: GroundedDestination;
    sources: GroundingSource[];
    ttlDays: number;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const data = {
      destinationLabel: input.destinationLabel,
      payload: input.payload as Prisma.InputJsonValue,
      sources: input.sources as Prisma.InputJsonValue,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + input.ttlDays * DAY_MS),
    };

    return prisma.verifiedPoiCache.upsert({
      where: { destinationKey: input.destinationKey },
      create: { destinationKey: input.destinationKey, ...data },
      update: data,
    });
  }
}
