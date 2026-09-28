import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SlotKey, SlotProposalOption } from "@/lib/slot-vote";

const proposalContextInclude = {
  votes: true,
  day: {
    select: {
      id: true,
      tripVersion: {
        select: {
          tripId: true,
          trip: { select: { organizerId: true, deletedAt: true } },
        },
      },
    },
  },
} as const;

export type SlotProposalWithContext = Prisma.SlotProposalGetPayload<{
  include: typeof proposalContextInclude;
}>;

export class SlotProposalRepository {
  async findMember(tripId: string, userId: string) {
    return prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
  }

  async countMembers(tripId: string) {
    return prisma.tripMember.count({ where: { tripId } });
  }

  async findWithContext(
    proposalId: string,
  ): Promise<SlotProposalWithContext | null> {
    return prisma.slotProposal.findUnique({
      where: { id: proposalId },
      include: proposalContextInclude,
    });
  }

  /**
   * Nuova bozza per uno slot. Al massimo una proposta "viva" (bozza/aperta)
   * per slot: le bozze precedenti vengono eliminate e una votazione aperta
   * viene annullata, perché il contenuto dello slot è appena cambiato e le sue
   * opzioni non sono più coerenti con esso.
   */
  async createDraft(input: {
    dayId: string;
    slotKey: SlotKey;
    options: SlotProposalOption[];
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.slotProposal.deleteMany({
        where: {
          dayId: input.dayId,
          slotKey: input.slotKey,
          status: "draft",
        },
      });
      await tx.slotProposal.updateMany({
        where: { dayId: input.dayId, slotKey: input.slotKey, status: "open" },
        data: { status: "cancelled", resolvedAt: new Date() },
      });
      return tx.slotProposal.create({
        data: {
          dayId: input.dayId,
          slotKey: input.slotKey,
          options: input.options as Prisma.InputJsonValue,
        },
      });
    });
  }

  /** Apre la votazione (solo da bozza). Ritorna false se la proposta non era una bozza. */
  async open(proposalId: string, now: Date, expiresAt: Date) {
    const res = await prisma.slotProposal.updateMany({
      where: { id: proposalId, status: "draft" },
      data: { status: "open", openedAt: now, expiresAt },
    });
    return res.count === 1;
  }

  async upsertVote(proposalId: string, memberId: string, optionIndex: number) {
    return prisma.slotVote.upsert({
      where: { proposalId_memberId: { proposalId, memberId } },
      create: { proposalId, memberId, optionIndex },
      update: { optionIndex },
    });
  }

  async listVotes(proposalId: string) {
    return prisma.slotVote.findMany({ where: { proposalId } });
  }

  /**
   * Chiude la proposta e, se ha vinto un'alternativa, ne applica il contenuto
   * allo slot. Idempotente: l'update condizionale su status="open" garantisce
   * che, con più voti simultanei che innescano la stessa decisione, una sola
   * esecuzione la applichi (le altre ricevono false e non toccano lo slot).
   */
  async resolve(input: {
    proposalId: string;
    winnerIndex: number;
    apply: { dayId: string; slotKey: SlotKey; slotJson: string } | null;
    now?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const res = await tx.slotProposal.updateMany({
        where: { id: input.proposalId, status: "open" },
        data: {
          status: "resolved",
          winnerIndex: input.winnerIndex,
          resolvedAt: input.now ?? new Date(),
        },
      });
      if (res.count === 0) return false;

      if (input.apply) {
        await tx.day.update({
          where: { id: input.apply.dayId },
          data: { [input.apply.slotKey]: input.apply.slotJson },
        });
      }
      return true;
    });
  }

  /** Proposte aperte la cui finestra di voto è scaduta. */
  async listExpiredOpen(now: Date) {
    return prisma.slotProposal.findMany({
      where: { status: "open", expiresAt: { lte: now } },
      include: proposalContextInclude,
      take: 200,
    });
  }
}
