import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";
import { toDateOnlyIsoUtc } from "@/lib/calendar-date";
import {
  creditExpiryReminderHtml,
  sendTransactionalEmail,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as tr } from "@/lib/email/email-i18n";

const REMINDER_DAYS = [30, 7, 1] as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Cron job giornaliero (03:00 UTC).
 * Per ogni soglia (30, 7, 1 giorno), trova crediti non usati con
 * `expiresAt` che cade esattamente a quella distanza da oggi,
 * e invia un'email promemoria.
 */
export const creditExpiryReminders = inngest.createFunction(
  {
    id: "credit-expiry-reminders",
    name: "Promemoria scadenza crediti",
    retries: 2,
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }) => {
    let totalSent = 0;

    for (const daysLeft of REMINDER_DAYS) {
      const sent = await step.run(`remind-${daysLeft}d`, async () => {
        const today = startOfDay(new Date());
        const targetDate = addDays(today, daysLeft);
        const targetNext = addDays(targetDate, 1);

        const credits = await prisma.credit.findMany({
          where: {
            used: false,
            expiresAt: { gte: targetDate, lt: targetNext },
          },
          select: {
            amount: true,
            expiresAt: true,
            user: { select: { email: true, language: true } },
          },
        });

        let count = 0;
        const tripsUrl = `${config.app.baseUrl}/app/trips?new=1`;

        for (const c of credits) {
          try {
            const locale = normalizeEmailLocale(c.user.language);
            const subject =
              daysLeft === 1
                ? tr("subject.creditExpiryTomorrow", locale)
                : tr("subject.creditExpiryDays", locale, {
                    days: String(daysLeft),
                  });
            await sendTransactionalEmail({
              to: c.user.email,
              subject,
              html: creditExpiryReminderHtml({
                creditAmount: `€${Number(c.amount).toFixed(2)}`,
                daysLeft,
                expiresAt: toDateOnlyIsoUtc(c.expiresAt),
                tripsUrl,
                locale,
              }),
            });
            count++;
          } catch (err) {
            logger.error("Errore invio promemoria credito", err as Error, {
              email: redactEmail(c.user.email),
              daysLeft,
            });
          }
        }

        return count;
      });

      totalSent += sent;
    }

    return { sent: totalSent };
  },
);
