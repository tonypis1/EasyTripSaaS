import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  computeMemberTotals,
  toCents,
  type SplitExpense,
} from "@/lib/expense-split";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function exp(overrides: Partial<SplitExpense> = {}): SplitExpense {
  return {
    amount: 100,
    paidById: "a",
    splitEqually: true,
    participants: [],
    ...overrides,
  };
}

describe("allocateByWeights", () => {
  it("divide in parti uguali assegnando il centesimo residuo al primo in elenco", () => {
    expect(allocateByWeights(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it("rispetta la proporzione dei pesi", () => {
    expect(allocateByWeights(9000, [1, 2])).toEqual([3000, 6000]);
    expect(allocateByWeights(1000, [1, 2])).toEqual([333, 667]);
  });

  it("accetta pesi decimali (es. mezza quota)", () => {
    expect(allocateByWeights(1000, [0.5, 1.5])).toEqual([250, 750]);
  });

  it("gestisce importo zero e nessun peso", () => {
    expect(allocateByWeights(0, [1, 1])).toEqual([0, 0]);
    expect(allocateByWeights(500, [])).toEqual([]);
  });

  it("rifiuta pesi non positivi", () => {
    expect(() => allocateByWeights(100, [1, 0])).toThrow();
    expect(() => allocateByWeights(100, [1, -1])).toThrow();
  });

  it("la somma delle quote è SEMPRE esattamente l'importo (proprietà, 2000 scenari)", () => {
    let seed = 42;
    const rand = () =>
      (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

    for (let i = 0; i < 2000; i++) {
      const total = Math.floor(rand() * 5_000_000);
      const n = 1 + Math.floor(rand() * 8);
      const weights = Array.from(
        { length: n },
        () => (1 + Math.floor(rand() * 400)) / 100,
      );

      const shares = allocateByWeights(total, weights);

      expect(sum(shares)).toBe(total);
      expect(shares.every((s) => Number.isInteger(s) && s >= 0)).toBe(true);
    }
  });
});

describe("computeMemberTotals", () => {
  const members = ["a", "b", "c", "d"];

  it("senza partecipanti divide equamente tra tutti i membri (comportamento storico)", () => {
    const t = computeMemberTotals(members, [
      exp({ amount: 40, paidById: "a" }),
    ]);

    expect(t.get("a")).toEqual({
      paidCents: 4000,
      owedCents: 1000,
      balanceCents: 3000,
    });
    expect(t.get("b")?.balanceCents).toBe(-1000);
  });

  it("con un sottoinsieme (2 membri su 4) addebita solo i partecipanti", () => {
    const t = computeMemberTotals(members, [
      exp({
        amount: 60,
        paidById: "a",
        participants: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      }),
    ]);

    expect(t.get("a")?.balanceCents).toBe(3000); // ha pagato 60, deve 30
    expect(t.get("b")?.balanceCents).toBe(-3000);
    expect(t.get("c")?.balanceCents).toBe(0);
    expect(t.get("d")?.balanceCents).toBe(0);
  });

  it("split pesato: una famiglia da 2 quote paga il doppio", () => {
    const t = computeMemberTotals(
      ["a", "b", "c"],
      [
        exp({
          amount: 90,
          paidById: "a",
          participants: [
            { memberId: "a", weight: 1 },
            { memberId: "b", weight: 1 },
            { memberId: "c", weight: 2 },
          ],
        }),
      ],
    );

    expect(t.get("c")?.owedCents).toBe(4500);
    expect(t.get("b")?.owedCents).toBe(2250);
    expect(t.get("a")?.balanceCents).toBe(9000 - 2250);
  });

  it("il pagatore può non essere un partecipante (paga per gli altri)", () => {
    const t = computeMemberTotals(members, [
      exp({
        amount: 50,
        paidById: "a",
        participants: [
          { memberId: "b", weight: 1 },
          { memberId: "c", weight: 1 },
        ],
      }),
    ]);

    expect(t.get("a")?.balanceCents).toBe(5000);
    expect(t.get("b")?.balanceCents).toBe(-2500);
    expect(t.get("c")?.balanceCents).toBe(-2500);
  });

  it("una spesa personale (splitEqually=false) non incide su pagato né saldi", () => {
    const t = computeMemberTotals(members, [
      exp({ amount: 80, paidById: "a", splitEqually: false }),
    ]);

    for (const id of members) {
      expect(t.get(id)).toEqual({
        paidCents: 0,
        owedCents: 0,
        balanceCents: 0,
      });
    }
  });

  it("ignora partecipanti sconosciuti e duplicati", () => {
    const t = computeMemberTotals(
      ["a", "b"],
      [
        exp({
          amount: 10,
          paidById: "a",
          participants: [
            { memberId: "b", weight: 1 },
            { memberId: "b", weight: 5 },
            { memberId: "fantasma", weight: 1 },
          ],
        }),
      ],
    );

    expect(t.get("b")?.owedCents).toBe(1000);
    expect(t.get("a")?.balanceCents).toBe(1000);
  });

  it("se nessun partecipante è più nel trip ripiega sulla divisione tra tutti", () => {
    const t = computeMemberTotals(
      ["a", "b"],
      [
        exp({
          amount: 10,
          paidById: "a",
          participants: [{ memberId: "fantasma", weight: 1 }],
        }),
      ],
    );

    expect(t.get("b")?.owedCents).toBe(500);
  });

  it("ignora una spesa il cui pagatore non è più nel trip (mantiene Σ saldi = 0)", () => {
    const t = computeMemberTotals(
      ["a", "b"],
      [exp({ amount: 10, paidById: "ex-membro" })],
    );

    expect(sum([...t.values()].map((x) => x.balanceCents))).toBe(0);
    expect(t.get("a")?.owedCents).toBe(0);
  });

  it("il risultato non dipende dall'ordine dei partecipanti (resto sempre agli stessi membri)", () => {
    const participants = [
      { memberId: "c", weight: 1 },
      { memberId: "a", weight: 1 },
      { memberId: "b", weight: 1 },
    ];
    const one = computeMemberTotals(
      ["a", "b", "c"],
      [exp({ amount: 100, paidById: "a", participants })],
    );
    const two = computeMemberTotals(
      ["a", "b", "c"],
      [
        exp({
          amount: 100,
          paidById: "a",
          participants: [...participants].reverse(),
        }),
      ],
    );

    expect([...one.entries()]).toEqual([...two.entries()]);
  });

  it("Σ saldi = 0 esatto su scenari misti casuali (proprietà, 1000 scenari)", () => {
    let seed = 7;
    const rand = () =>
      (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const ids = ["m1", "m2", "m3", "m4", "m5"];

    for (let i = 0; i < 1000; i++) {
      const expenses: SplitExpense[] = Array.from(
        { length: 1 + Math.floor(rand() * 6) },
        () => {
          const chosen = ids.filter(() => rand() < 0.6);
          return {
            amount: Math.round(rand() * 250_000) / 100 + 0.01,
            paidById: ids[Math.floor(rand() * ids.length)],
            splitEqually: rand() < 0.85,
            participants: chosen.map((memberId) => ({
              memberId,
              weight: (1 + Math.floor(rand() * 300)) / 100,
            })),
          };
        },
      );

      const totals = computeMemberTotals(ids, expenses);

      expect(sum([...totals.values()].map((t) => t.balanceCents))).toBe(0);
    }
  });
});

describe("toCents", () => {
  it("arrotonda correttamente importi con errori di virgola mobile", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005 * 100) / 100).toBeCloseTo(100.5, 2);
    expect(toCents(19.99)).toBe(1999);
  });
});
