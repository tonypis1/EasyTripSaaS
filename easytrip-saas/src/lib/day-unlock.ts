/**
 * Sblocco “a minuti”: ogni giorno si sblocca solo dopo le 00:01 locali del device.
 * La stringa `unlockDateStr` è `YYYY-MM-DD` (data di calendario).
 */
export function isDayUnlocked(unlockDateStr: string, now = new Date()): boolean {
  const [y, m, d] = unlockDateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const unlockAt = new Date(y, m - 1, d, 0, 1, 0, 0); // 00:01:00.000 del giorno locale
  return now >= unlockAt;
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
