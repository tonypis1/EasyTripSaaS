import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";
import {
  nurtureNoTripHtml,
  sendMarketingEmail,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as tr } from "@/lib/email/email-i18n";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type Phase = 3 | 7;

async function runNurturePhase(phase: Phase): Promise<number> {
  const today = startOfDay(new Date());
  const targetDate = addDays(today, -phase);
  const targetNext = addDays(targetDate, 1);

  const users = await prisma.user.findMany({
    where: {
      marketingOptIn: true,
      ...(phase === 3
        ? { nurtureNoTrip3SentAt: null }
        : { nurtureNoTrip7SentAt: null }),
      createdAt: { gte: targetDate, lt: targetNext },
      tripsAsOrganizer: {
        none: {
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      email: true,
      language: true,
    },
  });

  let count = 0;
  const appUrl = config.app.baseUrl;

  for (const u of users) {
    try {
      const locale = normalizeEmailLocale(u.language);
      await sendMarketingEmail({
        to: u.email,
        subject:
          phase === 3
            ? tr("subject.nurtureNoTrip3", locale)
            : tr("subject.nurtureNoTrip7", locale),
        html: nurtureNoTripHtml({ phase, appUrl, locale }),
      });
      await prisma.user.update({
        where: { id: u.id },
        data:
          phase === 3
            ? { nurtureNoTrip3SentAt: new Date() }
            : { nurtureNoTrip7SentAt: new Date() },
      });
      count++;
    } catch (err) {
      logger.error("Nurture no-trip email fallita", err as Error, {
        phase,
        email: redactEmail(u.email),
      });
    }
  }

  return count;
}

/**
 * Cron giornaliero (04:00): email marketing D+3 e D+7 per utenti senza viaggi
 * (nessun trip da organizzatore non eliminato), solo se `marketingOptIn`.
 */
export const nurtureNoTrip = inngest.createFunction(
  {
    id: "nurture-no-trip",
    name: "Nurture senza viaggio (marketing)",
    retries: 2,
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const d3 = await step.run("nurture-d3", () => runNurturePhase(3));
    const d7 = await step.run("nurture-d7", () => runNurturePhase(7));
    return { nurtureD3: d3, nurtureD7: d7 };
  },
);
