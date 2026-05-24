/** Regole allineate alla FAQ prodotto: 3 rigenerazioni gratis (versioni 2–4), poi 5–7 a pagamento. */

export const MAX_TRIP_VERSION = 7;

/** Versione inclusa nell'acquisto iniziale = 1. Le rigenerazioni gratuite portano a v2, v3, v4. */
export const FREE_REGEN_MAX_NEXT_VERSION = 4;

export const REGEN_PRICE_EUR = 1.99;

/** Centesimi per Stripe (€1,99). */
export const REGEN_PRICE_CENTS = 199;

/**
 * Prossimo numero di versione se si rigenera ora (`regenCount` sul Trip = ultima versione creata).
 */
export function nextVersionNum(regenCount: number): number {
  return regenCount + 1;
}

export function canCreateNewVersion(regenCount: number): boolean {
  return nextVersionNum(regenCount) <= MAX_TRIP_VERSION;
}

/** Rigenerazione senza checkout Stripe (versioni 2, 3, 4). */
export function isFreeRegeneration(regenCount: number): boolean {
  const next = nextVersionNum(regenCount);
  return next >= 2 && next <= FREE_REGEN_MAX_NEXT_VERSION;
}

/** Rigenerazione a pagamento (versioni 5, 6, 7). */
export function isPaidRegeneration(regenCount: number): boolean {
  const next = nextVersionNum(regenCount);
  return next > FREE_REGEN_MAX_NEXT_VERSION && next <= MAX_TRIP_VERSION;
}
