import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ExpenseRepository } from "@/server/repositories/ExpenseRepository";

const run = !!process.env.DATABASE_URL;

describe.skipIf(!run)("Split spese 2.0 (integration)", () => {
  const repo = new ExpenseRepository();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let tripId: string;
  let userIds: string[] = [];
  let m: string[] = []; // TripMember.id di Anna, Bob, Chiara, Dario

  async function balancesByMember() {
    const rows = await prisma.tripMember.findMany({ where: { tripId } });
    return Object.fromEntries(
      m.map((id) => {
        const row = rows.find((r) => r.id === id);
        return [id, row ? Number(row.balance) : null];
      }),
    );
  }

  beforeAll(async () => {
    const names = ["Anna", "Bob", "Chiara", "Dario"];
    const users = await Promise.all(
      names.map((name) =>
        prisma.user.create({
          data: {
            clerkUserId: `int_split_${name}_${suffix}`,
            email: `int_split_${name}_${suffix}@example.com`,
            name,
          },
        }),
      ),
    );
    userIds = users.map((u) => u.id);

    const trip = await prisma.trip.create({
      data: {
        organizerId: userIds[0],
        destination: "Roma",
        startDate: new Date(Date.UTC(2026, 5, 1)),
        endDate: new Date(Date.UTC(2026, 5, 3)),
        accessExpiresAt: new Date(Date.UTC(2026, 11, 31)),
        tripType: "gruppo",
        status: "active",
      },
    });
    tripId = trip.id;

    const members = await Promise.all(
      userIds.map((userId, i) =>
        prisma.tripMember.create({
          data: { tripId, userId, role: i === 0 ? "org" : "member" },
        }),
      ),
    );
    m = members.map((x) => x.id);
  });

  afterAll(async () => {
    if (tripId) await prisma.trip.delete({ where: { id: tripId } });
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it("una spesa storica (senza partecipanti) si divide in parti uguali tra tutti e 4", async () => {
    await repo.create({
      tripId,
      paidById: m[0],
      amount: 80,
      description: "Cena tutti",
      category: "cibo",
      splitEqually: true,
    });
    await repo.recalculateBalances(tripId);

    expect(await balancesByMember()).toEqual({
      [m[0]]: 60,
      [m[1]]: -20,
      [m[2]]: -20,
      [m[3]]: -20,
    });
  });

  it("spesa tra 2 membri su 4: solo i partecipanti vengono addebitati, la somma dei saldi resta 0", async () => {
    await repo.create({
      tripId,
      paidById: m[1],
      amount: 60,
      description: "Taxi Bob+Chiara",
      category: "trasporti",
      splitEqually: true,
      participants: [
        { memberId: m[1], weight: 1 },
        { memberId: m[2], weight: 1 },
      ],
    });
    await repo.recalculateBalances(tripId);

    // Bob: -20 (cena) + 60 pagati - 30 quota = +10. Chiara: -20 - 30 = -50. Dario invariato.
    expect(await balancesByMember()).toEqual({
      [m[0]]: 60,
      [m[1]]: 10,
      [m[2]]: -50,
      [m[3]]: -20,
    });
  });

  it("quote pesate con residuo di centesimo: la somma dei saldi resta esattamente 0", async () => {
    await repo.create({
      tripId,
      paidById: m[3],
      amount: 100,
      description: "Escursione",
      category: "attivita",
      splitEqually: true,
      participants: [
        { memberId: m[0], weight: 1 },
        { memberId: m[1], weight: 1 },
        { memberId: m[2], weight: 1 },
      ],
    });
    await repo.recalculateBalances(tripId);

    const balances = Object.values(await balancesByMember()) as number[];
    const totalCents = balances.reduce((s, b) => s + Math.round(b * 100), 0);
    expect(totalCents).toBe(0);
  });

  it("la lista include partecipanti e quote, ordinati; la spesa storica ha partecipanti vuoti", async () => {
    const list = await repo.listByTrip(tripId);
    const taxi = list.find((e) => e.description === "Taxi Bob+Chiara");
    const cena = list.find((e) => e.description === "Cena tutti");

    expect(taxi?.participants.map((p) => p.memberId).sort()).toEqual(
      [m[1], m[2]].sort(),
    );
    expect(Number(taxi?.participants[0].weight)).toBe(1);
    expect(cena?.participants).toEqual([]);
  });

  it("lo stesso membro non può comparire due volte nella stessa spesa (vincolo unique)", async () => {
    const expense = await prisma.expense.findFirstOrThrow({
      where: { tripId, description: "Taxi Bob+Chiara" },
    });

    await expect(
      prisma.expenseParticipant.create({
        data: { expenseId: expense.id, memberId: m[1], weight: 3 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("eliminare una spesa elimina in cascata le sue quote e ricalcola i saldi", async () => {
    const expense = await prisma.expense.findFirstOrThrow({
      where: { tripId, description: "Taxi Bob+Chiara" },
    });

    await repo.deleteById(expense.id, tripId);
    await repo.recalculateBalances(tripId);

    expect(
      await prisma.expenseParticipant.count({
        where: { expenseId: expense.id },
      }),
    ).toBe(0);
    const balances = Object.values(await balancesByMember()) as number[];
    expect(balances.reduce((s, b) => s + Math.round(b * 100), 0)).toBe(0);
  });
});
