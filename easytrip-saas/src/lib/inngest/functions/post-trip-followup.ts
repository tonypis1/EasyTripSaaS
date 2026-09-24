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

    /**
     * Un email per step (non un loop dentro un unico step.run): se il job
     * crasha a metà elenco, Inngest ripete solo gli step non ancora
     * completati con successo — quelli già inviati restano memoizzati e non
     * vengono rimandati al retry.
     */
    const feedbackTrips = await step.run("load-feedback-trips", async () => {
      const today = startOfDay(new Date());
      const yesterday = addDays(today, -1);
      const yesterdayEnd = today;

      return prisma.trip.findMany({
        where: {
          paymentId: { not: null },
          endDate: { gte: yesterday, lt: yesterdayEnd },
        },
        select: {
          id: true,
          destination: true,
          organizer: {
            select: { email: true, language: true, referralCode: true },
          },
        },
      });
    });

    let feedbackSent = 0;
    for (const t of feedbackTrips) {
      const sent = await step.run(`feedback-1d:${t.id}`, async () => {
        try {
          const locale = normalizeEmailLocale(t.organizer.language);
          const referralUrl = t.organizer.referralCode
            ? `${baseUrl}/?ref=${encodeURIComponent(t.organizer.referralCode)}`
            : null;
          await sendTransactionalEmail({
            to: t.organizer.email,
            subject: tr("subject.postTripFeedback", locale, {
              destination: t.destination,
            }),
            html: postTripFeedbackHtml({
              destination: t.destination,
              newTripUrl,
              locale,
              referralUrl,
            }),
          });
          return true;
        } catch (err) {
          logger.error("Post-trip feedback email failed", err as Error, {
            tripId: t.id,
          });
          return false;
        }
      });
      if (sent) feedbackSent++;
    }

    const reengageTrips = await step.run("load-reengage-trips", async () => {
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
          organizer: {
            select: { email: true, language: true, referralCode: true },
          },
        },
      });

      // Dedup per email PRIMA di generare gli step: un organizzatore con più
      // trip finiti lo stesso giorno deve ricevere una sola email, e le
      // chiavi degli step devono restare stabili tra i retry.
      const emailsSent = new Set<string>();
      return trips.filter((t) => {
        if (emailsSent.has(t.organizer.email)) return false;
        emailsSent.add(t.organizer.email);
        return true;
      });
    });

    let reengageSent = 0;
    for (const t of reengageTrips) {
      const sent = await step.run(`reengage-14d:${t.id}`, async () => {
        try {
          const locale = normalizeEmailLocale(t.organizer.language);
          const referralUrl = t.organizer.referralCode
            ? `${baseUrl}/?ref=${encodeURIComponent(t.organizer.referralCode)}`
            : null;
          await sendTransactionalEmail({
            to: t.organizer.email,
            subject: tr("subject.postTripReengage", locale),
            html: postTripReengageHtml({
              newTripUrl,
              locale,
              referralUrl,
            }),
          });
          return true;
        } catch (err) {
          logger.error("Post-trip reengage email failed", err as Error, {
            tripId: t.id,
          });
          return false;
        }
      });
      if (sent) reengageSent++;
    }

    return {
      feedbackSent,
      reengageSent,
      totalSent: feedbackSent + reengageSent,
    };
  },
);
