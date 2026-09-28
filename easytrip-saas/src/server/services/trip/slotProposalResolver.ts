import {
  SlotProposalRepository,
  type SlotProposalWithContext,
} from "@/server/repositories/SlotProposalRepository";
import { AppError } from "@/server/errors/AppError";
import { logger } from "@/lib/observability";
import {
  KEEP_CURRENT_INDEX,
  SlotProposalOptionsSchema,
  decideVote,
  type SlotKey,
} from "@/lib/slot-vote";

/**
 * Chiusura di una votazione e applicazione dell'opzione vincente allo slot.
 * Separato da SlotProposalService perché non richiede alcuna autenticazione:
 * lo usa anche il job schedulato che chiude le votazioni scadute.
 */
export class SlotProposalResolver {
  constructor(private readonly repo: SlotProposalRepository) {}

  /** Opzioni della proposta, validate: contenuto corrotto non viene mai applicato a uno slot. */
  parseOptions(proposal: SlotProposalWithContext) {
    const parsed = SlotProposalOptionsSchema.safeParse(proposal.options);
    if (!parsed.success) {
      throw new AppError("Proposta non valida", 500, "PROPOSAL_CORRUPT");
    }
    return parsed.data;
  }

  /**
   * Chiude la proposta con l'opzione indicata, applicandola allo slot se è
   * un'alternativa. Ritorna false se un altro processo l'aveva già chiusa.
   */
  async finalize(
    proposal: SlotProposalWithContext,
    winnerIndex: number,
  ): Promise<boolean> {
    const options = this.parseOptions(proposal);

    const apply =
      winnerIndex === KEEP_CURRENT_INDEX
        ? null
        : {
            dayId: proposal.dayId,
            slotKey: proposal.slotKey as SlotKey,
            slotJson: JSON.stringify(options[winnerIndex].slot),
          };

    return this.repo.resolve({
      proposalId: proposal.id,
      winnerIndex,
      apply,
    });
  }

  /**
   * Chiude le votazioni scadute con l'opzione in testa (senza voti: si
   * mantiene l'attuale). Un errore su una proposta non blocca le altre.
   * Ritorna quante ne ha chiuse.
   */
  async resolveExpired(now = new Date()): Promise<number> {
    const expired = await this.repo.listExpiredOpen(now);
    let resolved = 0;

    for (const proposal of expired) {
      try {
        const decision = decideVote({
          optionCount: this.parseOptions(proposal).length,
          votes: proposal.votes,
          totalMembers: await this.repo.countMembers(
            proposal.day.tripVersion.tripId,
          ),
          mode: "force",
        });
        if (await this.finalize(proposal, decision.winnerIndex ?? 0)) {
          resolved++;
        }
      } catch (error) {
        logger.warn("Chiusura votazione scaduta fallita", {
          proposalId: proposal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return resolved;
  }
}
