import { prisma } from "@/lib/prisma";

export type CreateExpenseInput = {
  tripId: string;
  paidById: string;
  amount: number;
  description: string;
  category: "cibo" | "trasporti" | "attivita" | "alloggio" | "altro";
  splitEqually: boolean;
  dayNumber?: number | null;
};

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
      },
      include: {
        paidBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
  }

  async listByTrip(tripId: string) {
    return prisma.expense.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" },
      include: {
        paidBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
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
   * Ricalcola balance e totalPaid di ogni membro basandosi su tutte le spese.
   * Formula: quota = amount / memberCount (per splitEqually=true)
   */
  async recalculateBalances(tripId: string) {
    const members = await prisma.tripMember.findMany({
      where: { tripId },
    });
    const expenses = await prisma.expense.findMany({
      where: { tripId },
    });

    const memberCount = members.length;
    if (memberCount === 0) return;

    const paidMap = new Map<string, number>();
    const owedMap = new Map<string, number>();

    for (const m of members) {
      paidMap.set(m.id, 0);
      owedMap.set(m.id, 0);
    }

    for (const exp of expenses) {
      const amount = Number(exp.amount);
      const payerId = exp.paidById;

      paidMap.set(payerId, (paidMap.get(payerId) ?? 0) + amount);

      if (exp.splitEqually) {
        const quota = amount / memberCount;
        for (const m of members) {
          owedMap.set(m.id, (owedMap.get(m.id) ?? 0) + quota);
        }
      }
    }

    const updates = members.map((m) => {
      const paid = paidMap.get(m.id) ?? 0;
      const owed = owedMap.get(m.id) ?? 0;
      const balance = paid - owed;

      return prisma.tripMember.update({
        where: { id: m.id },
        data: {
          totalPaid: paid,
          balance,
        },
      });
    });

    await prisma.$transaction(updates);
  }
}
