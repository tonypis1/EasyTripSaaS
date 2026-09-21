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
type NurtureUser = { id: string; email: string; language: string | null };

async function fetchNurtureUsers(phase: Phase): Promise<NurtureUser[]> {
  const today = startOfDay(new Date());
  const targetDate = addDays(today, -phase);
  const targetNext = addDays(targetDate, 1);

  return prisma.user.findMany({
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
}

async function sendNurtureEmail(
  phase: Phase,
  u: NurtureUser,
): Promise<boolean> {
  try {
    const locale = normalizeEmailLocale(u.language);
    const appUrl = config.app.baseUrl;
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
    return true;
  } catch (err) {
    logger.error("Nurture no-trip email fallita", err as Error, {
      phase,
      email: redactEmail(u.email),
    });
    return false;
  }
}

/**
 * Cron giornaliero (04:00): email marketing D+3 e D+7 per utenti senza viaggi
 * (nessun trip da organizzatore non eliminato), solo se `marketingOptIn`.
 *
 * Un email per step (non un loop dentro un unico step.run): se il job
 * crasha a metà elenco, Inngest ripete solo gli step non ancora completati
 * con successo — quelli già inviati restano memoizzati e non vengono
 * rimandati al retry.
 */
export const nurtureNoTrip = inngest.createFunction(
  {
    id: "nurture-no-trip",
    name: "Nurture senza viaggio (marketing)",
    retries: 2,
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const d3Users = await step.run("load-nurture-d3", () =>
      fetchNurtureUsers(3),
    );
    let nurtureD3 = 0;
    for (const u of d3Users) {
      const sent = await step.run(`nurture-d3:${u.id}`, () =>
        sendNurtureEmail(3, u),
      );
      if (sent) nurtureD3++;
    }

    const d7Users = await step.run("load-nurture-d7", () =>
      fetchNurtureUsers(7),
    );
    let nurtureD7 = 0;
    for (const u of d7Users) {
      const sent = await step.run(`nurture-d7:${u.id}`, () =>
        sendNurtureEmail(7, u),
      );
      if (sent) nurtureD7++;
    }

    return { nurtureD3, nurtureD7 };
  },
);
