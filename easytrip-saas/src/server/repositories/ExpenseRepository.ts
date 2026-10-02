import { prisma } from "@/lib/prisma";
import { computeMemberTotals } from "@/lib/expense-split";

export type CreateExpenseInput = {
  tripId: string;
  paidById: string;
  amount: number;
  description: string;
  category: "cibo" | "trasporti" | "attivita" | "alloggio" | "altro";
  splitEqually: boolean;
  dayNumber?: number | null;
  /** Vuoto/assente = tra tutti i membri in parti uguali. `memberId` è l'id di TripMember. */
  participants?: { memberId: string; weight: number }[];
};

const expenseInclude = {
  paidBy: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  participants: {
    include: {
      member: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { memberId: "asc" },
  },
} as const;

export class ExpenseRepository {
  async create(input: CreateExpenseInput) {
    return prisma.expense.create({
      data: {
        tripId: input.tripId,
        paidById: input.paidById,
        amount: input.amount,
        description: input.description,
        category: input.category,
        splitEqually: input.splitEqually,
        dayNumber: input.dayNumber ?? null,
        ...(input.participants && input.participants.length > 0
          ? {
              participants: {
                create: input.participants.map((p) => ({
                  memberId: p.memberId,
                  weight: p.weight,
                })),
              },
            }
          : {}),
      },
      include: expenseInclude,
    });
  }

  async listByTrip(tripId: string) {
    return prisma.expense.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" },
      include: expenseInclude,
    });
  }

  async deleteById(expenseId: string, tripId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, tripId },
    });
    if (!expense) return null;
    await prisma.expense.delete({ where: { id: expenseId } });
    return expense;
  }

  async getMembers(tripId: string) {
    return prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
  }

  /**
   * Ricalcola balance e totalPaid di ogni membro dalle spese condivise.
   *
   * - splitEqually=false: spesa personale, esclusa da totalPaid ("totale
   *   pagato per spese condivise", vedi commento su TripMember in
   *   schema.prisma) e dai saldi — altrimenti chi la paga risulterebbe
   *   creditore di un debito che il gruppo non ha mai generato.
   * - senza `participants`: divisa in parti uguali tra tutti i membri.
   * - con `participants`: divisa solo tra loro, in proporzione al peso.
   *
   * La matematica è in centesimi interi (src/lib/expense-split.ts): la somma
   * dei saldi è esattamente zero anche con quote pesate.
   */
  async recalculateBalances(tripId: string) {
    const members = await prisma.tripMember.findMany({
      where: { tripId },
    });
    if (members.length === 0) return;

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      include: { participants: true },
    });

    const totals = computeMemberTotals(
      members.map((m) => m.id),
      expenses.map((e) => ({
        amount: Number(e.amount),
        paidById: e.paidById,
        splitEqually: e.splitEqually,
        participants: e.participants.map((p) => ({
          memberId: p.memberId,
          weight: Number(p.weight),
        })),
      })),
    );

    const updates = members.map((m) => {
      const t = totals.get(m.id);
      return prisma.tripMember.update({
        where: { id: m.id },
        data: {
          totalPaid: (t?.paidCents ?? 0) / 100,
          balance: (t?.balanceCents ?? 0) / 100,
        },
      });
    });

    await prisma.$transaction(updates);
  }
}
