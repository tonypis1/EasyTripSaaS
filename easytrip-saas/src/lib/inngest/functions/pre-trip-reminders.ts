import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import {
  sendTransactionalEmail,
  preTripCountdownHtml,
  tripStartTodayHtml,
} from "@/lib/email/transactional";
import {
  normalizeEmailLocale,
  t as trEmail,
} from "@/lib/email/email-i18n";

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
    let totalSent = 0;

    const countdownSent = await step.run("countdown-3d", async () => {
      const today = startOfDay(new Date());
      const target = addDays(today, 3);
      const targetNext = addDays(target, 1);

      const trips = await prisma.trip.findMany({
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

      let count = 0;
      for (const t of trips) {
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
          count++;
        } catch (err) {
          logger.error("Pre-trip countdown email failed", err as Error, {
            tripId: t.id,
          });
        }
      }
      return count;
    });
    totalSent += countdownSent;

    const todaySent = await step.run("start-today", async () => {
      const today = startOfDay(new Date());
      const tomorrow = addDays(today, 1);

      const trips = await prisma.trip.findMany({
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

      let count = 0;
      for (const t of trips) {
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
          count++;
        } catch (err) {
          logger.error("Trip-start-today email failed", err as Error, {
            tripId: t.id,
          });
        }
      }
      return count;
    });
    totalSent += todaySent;

    return { countdownSent, todaySent, totalSent };
  },
);
