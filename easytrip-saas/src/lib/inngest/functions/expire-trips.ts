import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import {
  sendTransactionalEmail,
  tripExpiredHtml,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as trEmail } from "@/lib/email/email-i18n";

/**
 * Cron job giornaliero (02:00 UTC).
 * 1. Trova tutti i Trip con status "active" e accessExpiresAt < now
 * 2. Li marca come "expired"
 * 3. Invia email "viaggio terminato" con CTA riattivazione e nuovo viaggio
 */
export const expireTrips = inngest.createFunction(
  {
    id: "expire-trips",
    name: "Scadenza automatica trip",
    retries: 2,
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    const expired = await step.run("find-and-expire", async () => {
      const now = new Date();

      const overdue = await prisma.trip.findMany({
        where: {
          status: "active",
          accessExpiresAt: { lt: now },
          deletedAt: null,
        },
        select: {
          id: true,
          destination: true,
          organizer: { select: { email: true, language: true } },
        },
      });

      if (overdue.length === 0) return [];

      await prisma.trip.updateMany({
        where: { id: { in: overdue.map((t) => t.id) } },
        data: { status: "expired" },
      });

      return overdue.map((t) => ({
        tripId: t.id,
        destination: t.destination,
        email: t.organizer.email,
        language: t.organizer.language,
      }));
    });

    if (expired.length === 0) {
      return { expired: 0 };
    }

    await step.run("send-expiry-emails", async () => {
      const baseUrl = config.app.baseUrl;
      const newTripUrl = `${baseUrl}/app/trips?new=1`;

      for (const t of expired) {
        const tripUrl = `${baseUrl}/app/trips/${t.tripId}`;
        const locale = normalizeEmailLocale(t.language);
        try {
          await sendTransactionalEmail({
            to: t.email,
            subject: `🌅 ${trEmail("subject.tripExpired", locale)} — ${t.destination}`,
            html: tripExpiredHtml({
              destination: t.destination,
              tripUrl,
              newTripUrl,
              locale,
            }),
          });
        } catch (err) {
          logger.error("Errore invio email scadenza trip", err as Error, {
            tripId: t.tripId,
          });
        }
      }
    });

    return { expired: expired.length };
  },
);
