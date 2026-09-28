import { AuthService } from "@/server/services/auth/authService";
import { ExpenseRepository } from "@/server/repositories/ExpenseRepository";
import { TripRepository } from "@/server/repositories/TripRepository";
import { CreateExpenseInput } from "@/server/validators/expense.schema";
import { AppError } from "@/server/errors/AppError";

export type ExpenseDto = {
  id: string;
  amount: number;
  description: string;
  category: string;
  splitEqually: boolean;
  dayNumber: number | null;
  paidBy: {
    memberId: string;
    name: string | null;
    email: string;
  };
  /** null = divisa in parti uguali tra tutti i membri; altrimenti solo tra questi, in proporzione al peso. */
  participants: ExpenseParticipantDto[] | null;
  createdAt: string;
};

export type ExpenseParticipantDto = {
  memberId: string;
  name: string | null;
  email: string;
  weight: number;
};

export type BalanceEntryDto = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  totalPaid: number;
  balance: number;
};

export type SettlementDto = {
  from: { memberId: string; name: string | null };
  to: { memberId: string; name: string | null };
  amount: number;
};

function decToNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v != null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return 0;
}

type ExpenseRow = {
  id: string;
  amount: unknown;
  description: string;
  category: string;
  splitEqually: boolean;
  dayNumber: number | null;
  createdAt: Date;
  paidBy: { id: string; user: { name: string | null; email: string } };
  participants: {
    memberId: string;
    weight: unknown;
    member: { user: { name: string | null; email: string } };
  }[];
};

function toExpenseDto(e: ExpenseRow): ExpenseDto {
  return {
    id: e.id,
    amount: decToNum(e.amount),
    description: e.description,
    category: e.category,
    splitEqually: e.splitEqually,
    dayNumber: e.dayNumber,
    paidBy: {
      memberId: e.paidBy.id,
      name: e.paidBy.user.name,
      email: e.paidBy.user.email,
    },
    participants:
      e.participants.length > 0
        ? e.participants.map((p) => ({
            memberId: p.memberId,
            name: p.member.user.name,
            email: p.member.user.email,
            weight: decToNum(p.weight),
          }))
        : null,
    createdAt: e.createdAt.toISOString(),
  };
}

export class ExpenseService {
  constructor(
    private readonly authService: AuthService,
    private readonly expenseRepo: ExpenseRepository,
    private readonly tripRepo: TripRepository,
  ) {}

  private async requireMembership(tripId: string) {
    const user = await this.authService.getOrCreateCurrentUser();
    const isMember = await this.tripRepo.isMember(tripId, user.id);
    if (!isMember) {
      throw new AppError("Non sei membro di questo viaggio", 403, "NOT_MEMBER");
    }
    return user;
  }

  async addExpense(
    tripId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseDto> {
    const user = await this.requireMembership(tripId);

    const members = await this.expenseRepo.getMembers(tripId);
    const member = members.find((m) => m.userId === user.id);
    if (!member) {
      throw new AppError("Membro non trovato", 404, "MEMBER_NOT_FOUND");
    }

    // I partecipanti arrivano dal client: devono essere membri di QUESTO viaggio
    // (altrimenti si potrebbero attribuire quote a membri di altri viaggi).
    const memberIds = new Set(members.map((m) => m.id));
    const unknown = (input.participants ?? []).find(
      (p) => !memberIds.has(p.memberId),
    );
    if (unknown) {
      throw new AppError(
        "Partecipante non membro di questo viaggio",
        400,
        "INVALID_PARTICIPANT",
      );
    }

    const expense = await this.expenseRepo.create({
      tripId,
      paidById: member.id,
      amount: input.amount,
      description: input.description,
      category: input.category,
      splitEqually: input.splitEqually,
      dayNumber: input.dayNumber ?? null,
      participants: input.participants,
    });

    await this.expenseRepo.recalculateBalances(tripId);

    return toExpenseDto(expense);
  }

  async listExpenses(tripId: string): Promise<ExpenseDto[]> {
    await this.requireMembership(tripId);
    const expenses = await this.expenseRepo.listByTrip(tripId);
    return expenses.map(toExpenseDto);
  }

  async deleteExpense(
    tripId: string,
    expenseId: string,
  ): Promise<{ deleted: true }> {
    await this.requireMembership(tripId);
    const deleted = await this.expenseRepo.deleteById(expenseId, tripId);
    if (!deleted) {
      throw new AppError("Spesa non trovata", 404, "EXPENSE_NOT_FOUND");
    }
    await this.expenseRepo.recalculateBalances(tripId);
    return { deleted: true };
  }

  async getBalances(tripId: string): Promise<{
    members: BalanceEntryDto[];
    settlements: SettlementDto[];
  }> {
    await this.requireMembership(tripId);
    const members = await this.expenseRepo.getMembers(tripId);

    const balanceEntries: BalanceEntryDto[] = members.map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      totalPaid: decToNum(m.totalPaid),
      balance: decToNum(m.balance),
    }));

    const settlements = this.calculateSettlements(balanceEntries);

    return { members: balanceEntries, settlements };
  }

  private calculateSettlements(members: BalanceEntryDto[]): SettlementDto[] {
    const debtors: { memberId: string; name: string | null; amount: number }[] =
      [];
    const creditors: {
      memberId: string;
      name: string | null;
      amount: number;
    }[] = [];

    for (const m of members) {
      if (m.balance < -0.01) {
        debtors.push({
          memberId: m.memberId,
          name: m.name,
          amount: Math.abs(m.balance),
        });
      } else if (m.balance > 0.01) {
        creditors.push({
          memberId: m.memberId,
          name: m.name,
          amount: m.balance,
        });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements: SettlementDto[] = [];
    let di = 0;
    let ci = 0;

    while (di < debtors.length && ci < creditors.length) {
      const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
      if (transfer > 0.01) {
        settlements.push({
          from: { memberId: debtors[di].memberId, name: debtors[di].name },
          to: { memberId: creditors[ci].memberId, name: creditors[ci].name },
          amount: Math.round(transfer * 100) / 100,
        });
      }
      debtors[di].amount -= transfer;
      creditors[ci].amount -= transfer;

      if (debtors[di].amount < 0.01) di++;
      if (creditors[ci].amount < 0.01) ci++;
    }

    return settlements;
  }
}
