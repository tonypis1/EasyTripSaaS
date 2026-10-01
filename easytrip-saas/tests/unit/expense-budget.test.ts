import { describe, expect, it } from "vitest";
import {
  DAILY_BUDGET_PER_PERSON_EUR,
  resolveBudgetLevel,
  summarizeBudget,
  type BudgetExpense,
} from "@/lib/expense-budget";

function e(overrides: Partial<BudgetExpense> = {}): BudgetExpense {
  return {
    amount: 10,
    category: "cibo",
    dayNumber: null,
    splitEqually: true,
    ...overrides,
  };
}

const base = { budgetLevel: "moderate", memberCount: 4, totalDays: 5 };

describe("resolveBudgetLevel", () => {
  it("riconosce i livelli noti e ripiega su moderate", () => {
    expect(resolveBudgetLevel("economy")).toBe("economy");
    expect(resolveBudgetLevel("premium")).toBe("premium");
    expect(resolveBudgetLevel("boh")).toBe("moderate");
  });

  it("le chiavi ereditate dal prototipo non sono livelli (toString, constructor)", () => {
    expect(resolveBudgetLevel("toString")).toBe("moderate");
    expect(resolveBudgetLevel("constructor")).toBe("moderate");
  });
});

describe("summarizeBudget", () => {
  it("budget indicativo = tariffa giornaliera × persone × giorni", () => {
    const s = summarizeBudget({ ...base, expenses: [] });
    expect(s.indicativeBudget).toBe(
      DAILY_BUDGET_PER_PERSON_EUR.moderate * 4 * 5,
    );
    expect(s.totalSpent).toBe(0);
    expect(s.ratio).toBe(0);
    expect(s.status).toBe("ok");
  });

  it("somma solo le spese di gruppo: quelle personali non contano nel budget", () => {
    const s = summarizeBudget({
      ...base,
      expenses: [e({ amount: 100 }), e({ amount: 999, splitEqually: false })],
    });
    expect(s.totalSpent).toBe(100);
  });

  it("stato: ok sotto l'80%, warning dall'80%, over oltre il 100%", () => {
    const budget = DAILY_BUDGET_PER_PERSON_EUR.moderate * 4 * 5; // 2400
    const at = (amount: number) =>
      summarizeBudget({ ...base, expenses: [e({ amount })] }).status;

    expect(at(budget * 0.5)).toBe("ok");
    expect(at(budget * 0.8)).toBe("warning");
    expect(at(budget)).toBe("warning");
    expect(at(budget + 0.01)).toBe("over");
  });

  it("dettaglio per categoria ordinato per importo, con quota percentuale", () => {
    const s = summarizeBudget({
      ...base,
      expenses: [
        e({ amount: 30, category: "cibo" }),
        e({ amount: 10, category: "cibo" }),
        e({ amount: 60, category: "alloggio" }),
      ],
    });

    expect(s.byCategory).toEqual([
      { category: "alloggio", amount: 60, share: 0.6 },
      { category: "cibo", amount: 40, share: 0.4 },
    ]);
  });

  it("dettaglio per giorno ordinato, con le spese senza giorno in coda", () => {
    const s = summarizeBudget({
      ...base,
      expenses: [
        e({ amount: 5, dayNumber: 3 }),
        e({ amount: 7, dayNumber: null }),
        e({ amount: 2, dayNumber: 1 }),
        e({ amount: 4, dayNumber: 3 }),
      ],
    });

    expect(s.byDay).toEqual([
      { dayNumber: 1, amount: 2 },
      { dayNumber: 3, amount: 9 },
      { dayNumber: null, amount: 7 },
    ]);
  });

  it("somma in centesimi interi (0,1 + 0,2 = 0,3 esatto)", () => {
    const s = summarizeBudget({
      ...base,
      expenses: [e({ amount: 0.1 }), e({ amount: 0.2 })],
    });
    expect(s.totalSpent).toBe(0.3);
  });

  it("senza persone o giorni il budget è 0 e il rapporto non esplode", () => {
    const s = summarizeBudget({
      ...base,
      memberCount: 0,
      expenses: [e({ amount: 50 })],
    });
    expect(s.indicativeBudget).toBe(0);
    expect(s.ratio).toBe(0);
  });
});
