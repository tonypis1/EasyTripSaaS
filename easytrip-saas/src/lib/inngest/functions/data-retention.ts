import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";

/**
 * Cron: purge dati secondo retention policy (GDPR — conservazione limitata).
 * - Versioni itinerario non attive oltre la soglia giorni
 * - Trip soft-deleted oltre la soglia giorni (hard delete con ripulita FK)
 */
export const dataRetentionPurge = inngest.createFunction(
  {
    id: "data-retention-purge",
    name: "Data retention — versioni e trip eliminati",
    retries: 1,
    triggers: [{ cron: "0 4 * * 0" }],
  },
  async ({ step }) => {
    const inactiveDays = config.retention.inactiveTripVersionDays;
    const softDeletedDays = config.retention.softDeletedTripDays;

    const versionCutoff = new Date();
    versionCutoff.setDate(versionCutoff.getDate() - inactiveDays);

    const deletedTripCutoff = new Date();
    deletedTripCutoff.setDate(deletedTripCutoff.getDate() - softDeletedDays);

    const versionsDeleted = await step.run("purge-inactive-versions", async () => {
      const res = await prisma.tripVersion.deleteMany({
        where: {
          isActive: false,
          generatedAt: { lt: versionCutoff },
        },
      });
      return res.count;
    });

    const tripsPurged = await step.run("purge-soft-deleted-trips", async () => {
      const stale = await prisma.trip.findMany({
        where: {
          deletedAt: { not: null, lt: deletedTripCutoff },
        },
        select: { id: true },
      });
      if (stale.length === 0) return 0;
      const ids = stale.map((t) => t.id);

      await prisma.$transaction([
        prisma.payment.updateMany({
          where: { tripId: { in: ids } },
          data: { tripId: null },
        }),
        prisma.credit.updateMany({
          where: { originTripId: { in: ids } },
          data: { originTripId: null },
        }),
        prisma.credit.updateMany({
          where: { usedOnTripId: { in: ids } },
          data: { usedOnTripId: null },
        }),
        prisma.trip.deleteMany({ where: { id: { in: ids } } }),
      ]);

      return ids.length;
    });

    logger.info("Data retention purge completed", {
      versionsDeleted,
      tripsPurged,
      inactiveVersionDays: inactiveDays,
      softDeletedTripDays: softDeletedDays,
    });

    return { versionsDeleted, tripsPurged };
  },
);
