import { toCents } from "@/lib/expense-split";

export type BudgetLevelKey = "economy" | "moderate" | "premium";

/**
 * Budget giornaliero INDICATIVO per persona, in euro, tutto compreso
 * (alloggio, cibo, trasporti, attività). È un'assunzione di prodotto, non un
 * dato di mercato: il `budgetLevel` del trip è solo una fascia (economy |
 * moderate | premium), quindi qui la traduciamo in una cifra confrontabile con
 * le spese registrate. Tarabile in questo unico punto.
 */
export const DAILY_BUDGET_PER_PERSON_EUR: Record<BudgetLevelKey, number> = {
  economy: 60,
  moderate: 120,
  premium: 250,
};

/** Oltre questa quota del budget indicativo la barra passa ad "attenzione". */
const WARNING_RATIO = 0.8;

export function resolveBudgetLevel(level: string): BudgetLevelKey {
  return level in DAILY_BUDGET_PER_PERSON_EUR
    ? (level as BudgetLevelKey)
    : "moderate";
}

export type BudgetExpense = {
  amount: number;
  category: string;
  dayNumber: number | null;
  /** false = spesa personale: non conta nel budget del gruppo. */
  splitEqually: boolean;
};

export type BudgetSummary = {
  level: BudgetLevelKey;
  totalSpent: number;
  indicativeBudget: number;
  /** speso / budget indicativo (0 se il budget è 0). */
  ratio: number;
  status: "ok" | "warning" | "over";
  byCategory: { category: string; amount: number; share: number }[];
  /** `dayNumber: null` = spese non assegnate a un giorno (in coda). */
  byDay: { dayNumber: number | null; amount: number }[];
};

/**
 * Speso (spese di gruppo) vs budget indicativo del viaggio, con dettaglio per
 * categoria e per giorno. Somme in centesimi interi per evitare residui di
 * virgola mobile.
 */
export function summarizeBudget(params: {
  expenses: BudgetExpense[];
  budgetLevel: string;
  memberCount: number;
  totalDays: number;
}): BudgetSummary {
  const level = resolveBudgetLevel(params.budgetLevel);
  const shared = params.expenses.filter((e) => e.splitEqually);

  const byCategoryCents = new Map<string, number>();
  const byDayCents = new Map<number | null, number>();
  let totalCents = 0;

  for (const e of shared) {
    const cents = toCents(e.amount);
    totalCents += cents;
    byCategoryCents.set(
      e.category,
      (byCategoryCents.get(e.category) ?? 0) + cents,
    );
    byDayCents.set(e.dayNumber, (byDayCents.get(e.dayNumber) ?? 0) + cents);
  }

  const indicativeBudget =
    DAILY_BUDGET_PER_PERSON_EUR[level] *
    Math.max(0, params.memberCount) *
    Math.max(0, params.totalDays);
  const totalSpent = totalCents / 100;
  const ratio = indicativeBudget > 0 ? totalSpent / indicativeBudget : 0;

  return {
    level,
    totalSpent,
    indicativeBudget,
    ratio,
    status: ratio > 1 ? "over" : ratio >= WARNING_RATIO ? "warning" : "ok",
    byCategory: [...byCategoryCents.entries()]
      .map(([category, cents]) => ({
        category,
        amount: cents / 100,
        share: totalCents > 0 ? cents / totalCents : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    byDay: [...byDayCents.entries()]
      .map(([dayNumber, cents]) => ({ dayNumber, amount: cents / 100 }))
      .sort((a, b) =>
        a.dayNumber === null
          ? 1
          : b.dayNumber === null
            ? -1
            : a.dayNumber - b.dayNumber,
      ),
  };
}
