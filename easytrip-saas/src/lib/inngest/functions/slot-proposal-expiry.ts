import { inngest } from "../client";
import { logger } from "@/lib/observability";
import { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";

/**
 * Cron orario: chiude le votazioni di gruppo sugli slot la cui finestra
 * (SLOT_VOTE_WINDOW_HOURS) è scaduta, con l'opzione in testa — senza voti si
 * mantiene lo slot attuale. Così una proposta a cui non partecipano tutti i
 * membri non resta aperta all'infinito.
 */
export const slotProposalExpiry = inngest.createFunction(
  {
    id: "slot-proposal-expiry",
    name: "Chiusura votazioni slot scadute",
    retries: 2,
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const resolved = await step.run("resolve-expired", async () => {
      const resolver = new SlotProposalResolver(new SlotProposalRepository());
      const count = await resolver.resolveExpired();
      logger.info("Votazioni slot scadute chiuse", { resolved: count });
      return count;
    });

    return { resolved };
  },
);
