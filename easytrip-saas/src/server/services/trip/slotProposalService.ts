import { AuthService } from "@/server/services/auth/authService";
import {
  SlotProposalRepository,
  type SlotProposalWithContext,
} from "@/server/repositories/SlotProposalRepository";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";
import { AppError } from "@/server/errors/AppError";
import {
  KEEP_CURRENT_INDEX,
  SLOT_VOTE_WINDOW_HOURS,
  decideVote,
  toSlotProposalDto,
  type SlotProposalDto,
} from "@/lib/slot-vote";

const HOUR_MS = 60 * 60 * 1000;

export type VoteOutcome = {
  /** true se questo voto ha chiuso la votazione. */
  resolved: boolean;
  /** Opzione vincente, solo se `resolved`. */
  winnerIndex: number | null;
  /** Stato aggiornato della proposta (null se chiusa). */
  proposal: SlotProposalDto | null;
};

/**
 * Group voting sulle alternative generate da SlotReplaceService: l'organizzatore
 * apre la votazione, ogni membro vota, e l'opzione vincente viene applicata allo
 * slot. Vedi src/lib/slot-vote.ts per la regola di decisione.
 */
export class SlotProposalService {
  constructor(
    private readonly authService: AuthService,
    private readonly repo: SlotProposalRepository,
    private readonly resolver: SlotProposalResolver = new SlotProposalResolver(
      repo,
    ),
  ) {}

  private async loadForMember(tripId: string, proposalId: string) {
    const user = await this.authService.getOrCreateCurrentUser();
    const member = await this.repo.findMember(tripId, user.id);
    if (!member) {
      throw new AppError("Non sei membro di questo viaggio", 403, "NOT_MEMBER");
    }

    const proposal = await this.repo.findWithContext(proposalId);
    // Il tripId nell'URL deve coincidere con quello reale della proposta:
    // senza questo controllo un membro potrebbe agire su proposte di altri viaggi.
    if (
      !proposal ||
      proposal.day.tripVersion.tripId !== tripId ||
      proposal.day.tripVersion.trip.deletedAt !== null
    ) {
      throw new AppError("Proposta non trovata", 404, "PROPOSAL_NOT_FOUND");
    }
    return { user, member, proposal };
  }

  private requireOrganizer(proposal: SlotProposalWithContext, userId: string) {
    if (proposal.day.tripVersion.trip.organizerId !== userId) {
      throw new AppError("Solo l'organizzatore può farlo", 403, "FORBIDDEN");
    }
  }

  private toDto(
    proposal: SlotProposalWithContext,
    votes: { memberId: string; optionIndex: number }[],
    totalMembers: number,
    myMemberId: string | null,
  ) {
    return toSlotProposalDto({
      proposal: { ...proposal, votes },
      totalMembers,
      myMemberId,
    });
  }

  /** L'organizzatore apre al voto una bozza generata dalla sostituzione di uno slot. */
  async open(tripId: string, proposalId: string): Promise<SlotProposalDto> {
    const { user, member, proposal } = await this.loadForMember(
      tripId,
      proposalId,
    );
    this.requireOrganizer(proposal, user.id);

    const totalMembers = await this.repo.countMembers(tripId);

    if (proposal.status === "open") {
      const dto = this.toDto(proposal, proposal.votes, totalMembers, member.id);
      if (dto) return dto; // idempotente: già aperta
    }
    if (proposal.status !== "draft") {
      throw new AppError(
        "La proposta non può più essere aperta",
        409,
        "PROPOSAL_CLOSED",
      );
    }
    if (totalMembers < 2) {
      throw new AppError(
        "Servono almeno due membri per votare",
        400,
        "NOT_ENOUGH_MEMBERS",
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SLOT_VOTE_WINDOW_HOURS * HOUR_MS,
    );
    if (!(await this.repo.open(proposal.id, now, expiresAt))) {
      throw new AppError(
        "La proposta non può più essere aperta",
        409,
        "PROPOSAL_CLOSED",
      );
    }

    const dto = this.toDto(
      { ...proposal, expiresAt },
      [],
      totalMembers,
      member.id,
    );
    if (!dto) {
      throw new AppError("Proposta non valida", 500, "PROPOSAL_CORRUPT");
    }
    return dto;
  }

  /** Un membro esprime (o cambia) il proprio voto; se il voto decide l'esito, la proposta si chiude. */
  async vote(
    tripId: string,
    proposalId: string,
    optionIndex: number,
  ): Promise<VoteOutcome> {
    const { member, proposal } = await this.loadForMember(tripId, proposalId);

    // Scaduta = chiusa, anche se il job orario non l'ha ancora risolta: un voto
    // dopo la scadenza cambierebbe l'esito che valeva alla chiusura.
    const now = new Date();
    if (
      proposal.status !== "open" ||
      (proposal.expiresAt !== null && proposal.expiresAt <= now)
    ) {
      throw new AppError("La votazione non è aperta", 409, "PROPOSAL_NOT_OPEN");
    }
    const optionCount = this.resolver.parseOptions(proposal).length;
    if (optionIndex >= optionCount) {
      throw new AppError("Opzione non valida", 400, "INVALID_OPTION");
    }

    if (
      !(await this.repo.upsertVoteIfOpen(
        proposal.id,
        member.id,
        optionIndex,
        now,
      ))
    ) {
      throw new AppError("La votazione non è aperta", 409, "PROPOSAL_NOT_OPEN");
    }

    const [votes, totalMembers] = await Promise.all([
      this.repo.listVotes(proposal.id),
      this.repo.countMembers(tripId),
    ]);

    const decision = decideVote({
      optionCount,
      votes,
      totalMembers,
      mode: "auto",
    });

    if (decision.done && decision.winnerIndex !== null) {
      if (await this.resolver.finalize(proposal, decision.winnerIndex)) {
        return {
          resolved: true,
          winnerIndex: decision.winnerIndex,
          proposal: null,
        };
      }
      // Chiusa nel frattempo da un'altra richiesta (organizzatore, job orario,
      // nuova sostituzione): l'esito vero è quello salvato, non questo calcolo.
      const saved = await this.repo.findOutcome(proposal.id);
      return {
        resolved: true,
        winnerIndex:
          saved?.status === "resolved" && saved.winnerIndex !== null
            ? saved.winnerIndex
            : KEEP_CURRENT_INDEX,
        proposal: null,
      };
    }

    return {
      resolved: false,
      winnerIndex: null,
      proposal: this.toDto(proposal, votes, totalMembers, member.id),
    };
  }

  /** L'organizzatore chiude subito la votazione con l'opzione in testa. */
  async close(tripId: string, proposalId: string): Promise<VoteOutcome> {
    const { user, proposal } = await this.loadForMember(tripId, proposalId);
    this.requireOrganizer(proposal, user.id);

    if (proposal.status !== "open") {
      throw new AppError("La votazione non è aperta", 409, "PROPOSAL_NOT_OPEN");
    }

    const decision = decideVote({
      optionCount: this.resolver.parseOptions(proposal).length,
      votes: proposal.votes,
      totalMembers: await this.repo.countMembers(tripId),
      mode: "force",
    });
    const winnerIndex = decision.winnerIndex ?? KEEP_CURRENT_INDEX;
    await this.resolver.finalize(proposal, winnerIndex);

    return { resolved: true, winnerIndex, proposal: null };
  }
}
