import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/unifiedConfig";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";
import {
  sendTransactionalEmail,
  waitlistWelcomeHtml,
  waitlistValuePropHtml,
  waitlistFeaturesHtml,
  waitlistSocialProofHtml,
  waitlistFinalCtaHtml,
} from "@/lib/email/transactional";

const DRIP_STEPS = [
  {
    num: 1,
    delay: null,
    subject: "👋 Sei dentro. Ti aspettavamo.",
    html: (url: string) => waitlistWelcomeHtml({ signupUrl: url }),
  },
  {
    num: 2,
    delay: "1d" as const,
    subject: "🇵🇹 Come ho pianificato Lisbona in 32 secondi",
    html: (url: string) => waitlistValuePropHtml({ signupUrl: url }),
  },
  {
    num: 3,
    delay: "2d" as const,
    subject: "🤔 Il problema che TripAdvisor non risolverà mai",
    html: (url: string) => waitlistFeaturesHtml({ signupUrl: url }),
  },
  {
    num: 4,
    delay: "2d" as const,
    subject: "🎁 Invita un amico → 1 trip gratis",
    html: (url: string) => waitlistSocialProofHtml({ signupUrl: url }),
  },
  {
    num: 5,
    delay: "2d" as const,
    subject: "✈️ Dove vai il prossimo weekend?",
    html: (url: string) => waitlistFinalCtaHtml({ signupUrl: url }),
  },
] as const;

/**
 * Event-driven: triggered by "waitlist/signup".
 * Sends 5 emails over 7 days using Inngest step.sleep:
 *   Day 0 → Welcome
 *   Day 1 → Value prop
 *   Day 3 → Features
 *   Day 5 → Social proof
 *   Day 7 → Final CTA
 */
export const waitlistDrip = inngest.createFunction(
  {
    id: "waitlist-drip",
    name: "Waitlist drip sequence",
    retries: 2,
    triggers: [{ event: "waitlist/signup" }],
  },
  async ({ event, step }) => {
    const raw = event.data as {
      waitlistEntryId?: string;
      /** @deprecated Solo eventi legacy; l'email non va più inviata a Inngest. */
      email?: string;
    };
    const waitlistEntryId = raw.waitlistEntryId;
    if (!waitlistEntryId) {
      throw new Error(
        "waitlist/signup: waitlistEntryId mancante in event.data",
      );
    }
    const signupUrl = `${config.app.baseUrl}/app/trips?new=1`;
    let sent = 0;

    for (const drip of DRIP_STEPS) {
      if (drip.delay) {
        await step.sleep(`wait-drip-${drip.num}`, drip.delay);
      }

      await step.run(`send-drip-${drip.num}`, async () => {
        const entry = await prisma.waitlistEntry.findUnique({
          where: { id: waitlistEntryId },
        });
        if (!entry || entry.dripSent >= drip.num) return;

        const toEmail = entry.email;

        try {
          await sendTransactionalEmail({
            to: toEmail,
            subject: drip.subject,
            html: drip.html(signupUrl),
          });
        } catch (err) {
          logger.error("Waitlist drip email failed", err as Error, {
            email: redactEmail(toEmail),
            step: drip.num,
          });
          return;
        }

        await prisma.waitlistEntry.update({
          where: { id: waitlistEntryId },
          data: { dripSent: drip.num },
        });
      });

      sent++;
    }

    const lastEntry = await prisma.waitlistEntry.findUnique({
      where: { id: waitlistEntryId },
      select: { email: true },
    });
    return {
      emailRedacted: lastEntry ? redactEmail(lastEntry.email) : "[unknown]",
      sent,
    };
  },
);
