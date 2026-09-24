import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ExpenseService non aveva alcun test: copre i guard di membership, il
 * ricalcolo dei saldi (via un vero ExpenseRepository su prisma mockato, per
 * esercitare davvero la matematica di recalculateBalances) e l'algoritmo di
 * settlement (chi deve pagare chi per chiudere i conti di gruppo).
 */

const mocks = vi.hoisted(() => ({
  expenseCreate: vi.fn(),
  expenseFindMany: vi.fn(),
  expenseFindFirst: vi.fn(),
  expenseDelete: vi.fn(),
  tripMemberFindMany: vi.fn(),
  tripMemberUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    expense: {
      create: mocks.expenseCreate,
      findMany: mocks.expenseFindMany,
      findFirst: mocks.expenseFindFirst,
      delete: mocks.expenseDelete,
    },
    tripMember: {
      findMany: mocks.tripMemberFindMany,
      update: mocks.tripMemberUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { ExpenseService } from "@/server/services/expense/expenseService";
import { ExpenseRepository } from "@/server/repositories/ExpenseRepository";
import type { AuthService } from "@/server/services/auth/authService";
import type { TripRepository } from "@/server/repositories/TripRepository";

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "member1",
    userId: "user1",
    role: "member",
    balance: 0,
    totalPaid: 0,
    user: { id: "user1", name: "Anna", email: "anna@example.com" },
    ...overrides,
  };
}

function makeService(tripRepoOverrides: Record<string, unknown> = {}) {
  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({ id: "user1" }),
  } as unknown as AuthService;

  const tripRepository = {
    isMember: vi.fn().mockResolvedValue(true),
    ...tripRepoOverrides,
  } as unknown as TripRepository;

  const expenseRepo = new ExpenseRepository();

  return {
    service: new ExpenseService(authService, expenseRepo, tripRepository),
    tripRepository,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tripMemberFindMany.mockResolvedValue([member()]);
  mocks.expenseFindMany.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (promises) =>
    Promise.all(promises),
  );
  mocks.tripMemberUpdate.mockResolvedValue({});
});

describe("ExpenseService — membership guard", () => {
  it("lancia 403 NOT_MEMBER se l'utente non è membro del trip", async () => {
    const { service } = makeService({
      isMember: vi.fn().mockResolvedValue(false),
    });

    await expect(service.listExpenses("trip1")).rejects.toMatchObject({
      code: "NOT_MEMBER",
      statusCode: 403,
    });
  });
});

describe("ExpenseService.addExpense", () => {
  it("crea la spesa, ricalcola i saldi (split equo tra i membri) e ritorna il DTO", async () => {
    mocks.tripMemberFindMany.mockResolvedValue([
      member({ id: "m1", userId: "user1" }),
      member({
        id: "m2",
        userId: "user2",
        user: { id: "user2", name: "Bob", email: "bob@example.com" },
      }),
    ]);
    mocks.expenseCreate.mockResolvedValue({
      id: "exp1",
      amount: 40,
      description: "Cena",
      category: "cibo",
      splitEqually: true,
      dayNumber: 1,
      createdAt: new Date("2026-06-01T20:00:00Z"),
      paidBy: { id: "m1", user: { name: "Anna", email: "anna@example.com" } },
    });
    // getMembers() per trovare il memberId di user1
    mocks.tripMemberFindMany.mockResolvedValueOnce([
      member({ id: "m1", userId: "user1" }),
      member({ id: "m2", userId: "user2" }),
    ]);
    // recalculateBalances() rilegge i membri una seconda volta
    mocks.tripMemberFindMany.mockResolvedValueOnce([
      member({ id: "m1", userId: "user1" }),
      member({ id: "m2", userId: "user2" }),
    ]);
    mocks.expenseFindMany.mockResolvedValue([
      { id: "exp1", amount: 40, paidById: "m1", splitEqually: true },
    ]);

    const { service } = makeService();
    const dto = await service.addExpense("trip1", {
      amount: 40,
      description: "Cena",
      category: "cibo",
      splitEqually: true,
      dayNumber: 1,
    });

    expect(dto.id).toBe("exp1");
    expect(dto.paidBy.memberId).toBe("m1");
    expect(mocks.expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripId: "trip1",
          paidById: "m1",
          amount: 40,
        }),
      }),
    );

    // Split equo tra 2 membri: quota 20 a testa. m1 ha pagato 40 -> balance +20.
    // m2 non ha pagato nulla -> balance -20.
    expect(mocks.tripMemberUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { totalPaid: 40, balance: 20 },
    });
    expect(mocks.tripMemberUpdate).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: { totalPaid: 0, balance: -20 },
    });
  });

  it("lancia 404 MEMBER_NOT_FOUND se l'utente membro del trip non ha una riga TripMember", async () => {
    mocks.tripMemberFindMany.mockResolvedValue([]); // getMembers() vuoto

    const { service } = makeService();

    await expect(
      service.addExpense("trip1", {
        amount: 10,
        description: "x",
        category: "altro",
        splitEqually: true,
      }),
    ).rejects.toMatchObject({ code: "MEMBER_NOT_FOUND", statusCode: 404 });
  });
});

describe("ExpenseService.deleteExpense", () => {
  it("lancia 404 EXPENSE_NOT_FOUND se la spesa non appartiene al trip", async () => {
    mocks.expenseFindFirst.mockResolvedValue(null);
    const { service } = makeService();

    await expect(service.deleteExpense("trip1", "exp1")).rejects.toMatchObject({
      code: "EXPENSE_NOT_FOUND",
      statusCode: 404,
    });
    expect(mocks.expenseDelete).not.toHaveBeenCalled();
  });

  it("elimina la spesa e ricalcola i saldi", async () => {
    mocks.expenseFindFirst.mockResolvedValue({ id: "exp1" });
    mocks.expenseDelete.mockResolvedValue({});
    const { service } = makeService();

    const result = await service.deleteExpense("trip1", "exp1");

    expect(result).toEqual({ deleted: true });
    expect(mocks.expenseDelete).toHaveBeenCalledWith({ where: { id: "exp1" } });
    expect(mocks.tripMemberUpdate).toHaveBeenCalled(); // recalculateBalances ha girato
  });
});

describe("ExpenseService.getBalances — algoritmo di settlement", () => {
  it("nessun settlement quando tutti i saldi sono già a zero", async () => {
    mocks.tripMemberFindMany.mockResolvedValue([
      member({ id: "m1", balance: 0 }),
      member({ id: "m2", balance: 0 }),
    ]);
    const { service } = makeService();

    const { settlements } = await service.getBalances("trip1");
    expect(settlements).toHaveLength(0);
  });

  it("un debitore e un creditore con lo stesso importo generano un solo settlement", async () => {
    mocks.tripMemberFindMany.mockResolvedValue([
      member({ id: "m1", balance: 20 }),
      member({ id: "m2", balance: -20 }),
    ]);
    const { service } = makeService();

    const { settlements } = await service.getBalances("trip1");
    expect(settlements).toEqual([
      {
        from: { memberId: "m2", name: "Anna" },
        to: { memberId: "m1", name: "Anna" },
        amount: 20,
      },
    ]);
  });

  it("chiude i conti tra più membri con importi disomogenei (greedy debtor/creditor matching)", async () => {
    // m1 ha anticipato di più (+30), m2 in pari (0), m3 deve (-30)
    mocks.tripMemberFindMany.mockResolvedValue([
      member({ id: "m1", balance: 30 }),
      member({ id: "m2", balance: 0 }),
      member({ id: "m3", balance: -30 }),
    ]);
    const { service } = makeService();

    const { settlements } = await service.getBalances("trip1");
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: { memberId: "m3", name: "Anna" },
      to: { memberId: "m1", name: "Anna" },
      amount: 30,
    });

    // La somma dei trasferimenti "in uscita" deve pareggiare esattamente i debiti totali.
    const totalOut = settlements
      .filter((s) => s.from.memberId === "m3")
      .reduce((sum, s) => sum + s.amount, 0);
    expect(totalOut).toBeCloseTo(30, 2);
  });

  it("ignora scostamenti trascurabili (±0.01) come già saldati", async () => {
    mocks.tripMemberFindMany.mockResolvedValue([
      member({ id: "m1", balance: 0.005 }),
      member({ id: "m2", balance: -0.005 }),
    ]);
    const { service } = makeService();

    const { settlements } = await service.getBalances("trip1");
    expect(settlements).toHaveLength(0);
  });
});
