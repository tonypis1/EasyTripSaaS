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

/* ---------- countdown & trip phase ---------- */

export type TripPhase =
  | { phase: "pre"; daysUntil: number }
  | { phase: "ongoing"; currentDay: number; totalDays: number }
  | { phase: "completed" };

function parseLocalMidnight(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function diffCalendarDays(a: Date, b: Date): number {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bDay - aDay) / (1000 * 60 * 60 * 24));
}

/**
 * Calcola la fase del viaggio rispetto a oggi (fuso locale del browser).
 *   - "pre"     → il viaggio non è ancora iniziato (daysUntil ≥ 1)
 *   - "ongoing" → oggi è tra startDate e endDate inclusi
 *   - "completed" → endDate è passato
 */
export function tripPhase(
  startDateStr: string,
  endDateStr: string,
  now = new Date(),
): TripPhase {
  const start = parseLocalMidnight(startDateStr);
  const end = parseLocalMidnight(endDateStr);
  if (!start || !end) return { phase: "completed" };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today < start) {
    return { phase: "pre", daysUntil: diffCalendarDays(today, start) };
  }

  if (today <= end) {
    const currentDay = diffCalendarDays(start, today) + 1;
    const totalDays = diffCalendarDays(start, end) + 1;
    return { phase: "ongoing", currentDay, totalDays };
  }

  return { phase: "completed" };
}

/**
 * Giorni rimanenti fino allo sblocco di un singolo giorno.
 * Ritorna 0 se già sbloccato, altrimenti il numero di giorni di attesa.
 */
export function daysUntilUnlock(unlockDateStr: string, now = new Date()): number {
  const unlock = parseLocalMidnight(unlockDateStr);
  if (!unlock) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = diffCalendarDays(today, unlock);
  return diff > 0 ? diff : 0;
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
