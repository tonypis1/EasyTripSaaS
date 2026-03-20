/** Confronto solo sulla data di calendario (locale), coerente con unlock_date nel DB */

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
