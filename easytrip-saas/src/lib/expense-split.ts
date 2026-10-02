/**
 * Matematica dello split spese, in centesimi INTERI: con quote pesate la
 * divisione in virgola mobile lascia residui (33,33 + 33,33 + 33,33 ≠ 100) e
 * i saldi di gruppo non sommano più a zero. Qui ogni spesa viene ripartita
 * con il metodo del "resto maggiore", quindi la somma delle quote è
 * esattamente l'importo e la somma dei saldi è esattamente 0.
 *
 * Pure e senza dipendenze server: usate sia da
 * ExpenseRepository.recalculateBalances sia dall'anteprima nel form.
 */

/** I pesi hanno al massimo 2 decimali: si lavora in centesimi di quota. */
const WEIGHT_SCALE = 100;

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Ripartisce `totalCents` in quote intere proporzionali ai `weights`. Il
 * centesimo residuo va ai pesi con la parte frazionaria maggiore; a parità,
 * al primo in elenco (deterministico). La somma del risultato è sempre
 * esattamente `totalCents`.
 */
export function allocateByWeights(
  totalCents: number,
  weights: number[],
): number[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !(w > 0))) {
    throw new Error("I pesi devono essere numeri positivi");
  }

  const units = weights.map((w) => Math.round(w * WEIGHT_SCALE));
  const totalUnits = units.reduce((sum, u) => sum + u, 0);
  if (totalUnits <= 0)
    throw new Error("La somma dei pesi deve essere positiva");

  const numerators = units.map((u) => totalCents * u);
  const shares = numerators.map((n) => Math.floor(n / totalUnits));
  const remainder = totalCents - shares.reduce((sum, s) => sum + s, 0);

  const byFraction = numerators
    .map((n, index) => ({ index, fraction: n % totalUnits }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) shares[byFraction[i].index] += 1;

  return shares;
}

/**
 * Quote in centesimi per partecipante, calcolate in ordine stabile per id: il
 * centesimo di resto va sempre agli stessi membri, qualunque sia l'ordine in
 * cui arrivano. Unica funzione per i saldi (server) e per l'anteprima nel
 * modulo della spesa (client): l'anteprima mostra esattamente ciò che si salva.
 */
export function splitCentsByMember(
  totalCents: number,
  participants: readonly { memberId: string; weight: number }[],
): Map<string, number> {
  const ordered = [...participants].sort((a, b) =>
    a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0,
  );
  const shares = allocateByWeights(
    totalCents,
    ordered.map((p) => p.weight),
  );
  return new Map(ordered.map((p, i) => [p.memberId, shares[i]]));
}

export type SplitExpense = {
  amount: number;
  paidById: string;
  /** false = spesa personale: esclusa dai saldi di gruppo (vedi ExpenseRepository). */
  splitEqually: boolean;
  /** Vuoto = tra tutti i membri, in parti uguali. */
  participants: { memberId: string; weight: number }[];
};

export type MemberTotals = {
  paidCents: number;
  owedCents: number;
  balanceCents: number;
};

/**
 * Pagato, dovuto e saldo (pagato − dovuto) di ogni membro sulle spese condivise.
 * Una spesa senza partecipanti si divide equamente tra tutti i membri
 * (comportamento storico); con partecipanti, solo tra loro e in proporzione
 * al peso. Il pagatore non deve essere per forza un partecipante.
 */
export function computeMemberTotals(
  memberIds: string[],
  expenses: SplitExpense[],
): Map<string, MemberTotals> {
  const totals = new Map<string, MemberTotals>(
    memberIds.map((id) => [
      id,
      { paidCents: 0, owedCents: 0, balanceCents: 0 },
    ]),
  );

  for (const expense of expenses) {
    if (!expense.splitEqually) continue;
    const payer = totals.get(expense.paidById);
    if (!payer) continue; // pagatore non più nel trip: ignorarla mantiene Σ saldi = 0

    const cents = toCents(expense.amount);
    payer.paidCents += cents;

    const seen = new Set<string>();
    const recipients: { memberId: string; weight: number }[] = [];
    for (const p of expense.participants) {
      if (!totals.has(p.memberId) || seen.has(p.memberId)) continue;
      seen.add(p.memberId);
      recipients.push(p);
    }
    const split =
      recipients.length > 0
        ? recipients
        : memberIds.map((memberId) => ({ memberId, weight: 1 }));

    for (const [memberId, share] of splitCentsByMember(cents, split)) {
      const member = totals.get(memberId);
      if (member) member.owedCents += share;
    }
  }

  for (const t of totals.values()) t.balanceCents = t.paidCents - t.owedCents;
  return totals;
}
