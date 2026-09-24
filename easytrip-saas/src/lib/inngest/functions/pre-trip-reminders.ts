import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import {
  sendTransactionalEmail,
  preTripCountdownHtml,
  tripStartTodayHtml,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as trEmail } from "@/lib/email/email-i18n";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Cron giornaliero (04:00 UTC).
 * 1. Trip con startDate tra 3 giorni → email "Il viaggio inizia tra 3 giorni!"
 * 2. Trip con startDate = oggi → email "Buon viaggio!"
 */
export const preTripReminders = inngest.createFunction(
  {
    id: "pre-trip-reminders",
    name: "Promemoria pre-viaggio",
    retries: 2,
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const baseUrl = config.app.baseUrl;

    /**
     * Un email per step (non un loop dentro un unico step.run): se il job
     * crasha a metà elenco, Inngest ripete solo gli step non ancora
     * completati con successo — quelli già inviati restano memoizzati e non
     * vengono rimandati al retry.
     */
    const countdownTrips = await step.run("load-countdown-trips", async () => {
      const today = startOfDay(new Date());
      const target = addDays(today, 3);
      const targetNext = addDays(target, 1);

      return prisma.trip.findMany({
        where: {
          status: "active",
          deletedAt: null,
          paymentId: { not: null },
          startDate: { gte: target, lt: targetNext },
        },
        select: {
          id: true,
          destination: true,
          organizer: { select: { email: true, language: true } },
        },
      });
    });

    let countdownSent = 0;
    for (const t of countdownTrips) {
      const sent = await step.run(`countdown-3d:${t.id}`, async () => {
        try {
          const locale = normalizeEmailLocale(t.organizer.language);
          await sendTransactionalEmail({
            to: t.organizer.email,
            subject: `🗓️ ${trEmail("subject.preTripCountdown", locale)} — ${t.destination}`,
            html: preTripCountdownHtml({
              destination: t.destination,
              daysLeft: 3,
              tripUrl: `${baseUrl}/app/trips/${t.id}`,
              locale,
            }),
          });
          return true;
        } catch (err) {
          logger.error("Pre-trip countdown email failed", err as Error, {
            tripId: t.id,
          });
          return false;
        }
      });
      if (sent) countdownSent++;
    }

    const startTodayTrips = await step.run(
      "load-start-today-trips",
      async () => {
        const today = startOfDay(new Date());
        const tomorrow = addDays(today, 1);

        return prisma.trip.findMany({
          where: {
            status: "active",
            deletedAt: null,
            paymentId: { not: null },
            startDate: { gte: today, lt: tomorrow },
          },
          select: {
            id: true,
            destination: true,
            organizer: { select: { email: true, language: true } },
          },
        });
      },
    );

    let todaySent = 0;
    for (const t of startTodayTrips) {
      const sent = await step.run(`start-today:${t.id}`, async () => {
        try {
          const locale = normalizeEmailLocale(t.organizer.language);
          await sendTransactionalEmail({
            to: t.organizer.email,
            subject: `✈️ ${trEmail("subject.tripStartToday", locale)} — ${t.destination}`,
            html: tripStartTodayHtml({
              destination: t.destination,
              tripUrl: `${baseUrl}/app/trips/${t.id}`,
              locale,
            }),
          });
          return true;
        } catch (err) {
          logger.error("Trip-start-today email failed", err as Error, {
            tripId: t.id,
          });
          return false;
        }
      });
      if (sent) todaySent++;
    }

    return { countdownSent, todaySent, totalSent: countdownSent + todaySent };
  },
);
