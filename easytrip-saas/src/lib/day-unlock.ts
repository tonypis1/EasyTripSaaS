/**
 * Confronto solo sulla **data di calendario nel fuso del browser** (cioè del tuo PC),
 * non sull’ora esatta: alle 23:59 del 23 marzo conta ancora come “23 marzo”.
 * La stringa `unlockDateStr` è `YYYY-MM-DD` allineata al calendario salvato nel DB.
 */
export function isDayUnlocked(unlockDateStr: string, now = new Date()): boolean {
  const [y, m, d] = unlockDateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const unlock = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today >= unlock;
}

export function formatTripType(t: string) {
  const map: Record<string, string> = {
    solo: "Solo",
    coppia: "Coppia",
    gruppo: "Gruppo",
  };
  return map[t] ?? t;
}

export function formatStatus(s: string) {
  const map: Record<string, string> = {
    pending: "In preparazione",
    active: "Attivo",
    expired: "Scaduto",
    cancelled: "Annullato",
  };
  return map[s] ?? s;
}
