import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import {
  sendTransactionalEmail,
  postTripFeedbackHtml,
  postTripReengageHtml,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as tr } from "@/lib/email/email-i18n";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Cron giornaliero (05:00 UTC).
 * 1. Trip con endDate = ieri → email "Com'è andato il viaggio?"
 * 2. Trip con endDate = 14 giorni fa → email "Dove vai il prossimo weekend?"
 */
export const postTripFollowup = inngest.createFunction(
  {
    id: "post-trip-followup",
    name: "Follow-up post-viaggio",
    retries: 2,
    triggers: [{ cron: "0 5 * * *" }],
  },
  async ({ step }) => {
    const baseUrl = config.app.baseUrl;
    const newTripUrl = `${baseUrl}/app/trips?new=1`;
    let totalSent = 0;

    const feedbackSent = await step.run("feedback-1d", async () => {
      const today = startOfDay(new Date());
      const yesterday = addDays(today, -1);
      const yesterdayEnd = today;

      const trips = await prisma.trip.findMany({
        where: {
          paymentId: { not: null },
          endDate: { gte: yesterday, lt: yesterdayEnd },
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
            subject: tr("subject.postTripFeedback", locale, {
              destination: t.destination,
            }),
            html: postTripFeedbackHtml({
              destination: t.destination,
              newTripUrl,
              locale,
            }),
          });
          count++;
        } catch (err) {
          logger.error("Post-trip feedback email failed", err as Error, {
            tripId: t.id,
          });
        }
      }
      return count;
    });
    totalSent += feedbackSent;

    const reengageSent = await step.run("reengage-14d", async () => {
      const today = startOfDay(new Date());
      const target = addDays(today, -14);
      const targetNext = addDays(target, 1);

      const trips = await prisma.trip.findMany({
        where: {
          paymentId: { not: null },
          endDate: { gte: target, lt: targetNext },
        },
        select: {
          id: true,
          organizer: { select: { email: true, language: true } },
        },
      });

      const emailsSent = new Set<string>();
      let count = 0;
      for (const t of trips) {
        if (emailsSent.has(t.organizer.email)) continue;
        emailsSent.add(t.organizer.email);
        try {
          const locale = normalizeEmailLocale(t.organizer.language);
          await sendTransactionalEmail({
            to: t.organizer.email,
            subject: tr("subject.postTripReengage", locale),
            html: postTripReengageHtml({ newTripUrl, locale }),
          });
          count++;
        } catch (err) {
          logger.error("Post-trip reengage email failed", err as Error, {
            tripId: t.id,
          });
        }
      }
      return count;
    });
    totalSent += reengageSent;

    return { feedbackSent, reengageSent, totalSent };
  },
);
