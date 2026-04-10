/**
 * Date “solo giorno” come in PostgreSQL (@db.Date): aritmetica sul **calendario UTC**
 * così la generazione (Inngest/Node su qualsiasi fuso) non sposta i giorni per errore.
 *
 * In UI, `unlockDate` arriva come stringa `YYYY-MM-DD` e in `day-unlock.ts` viene
 * confrontata con **oggi sul PC dell’utente** (fuso del browser) — ore e minuti non
 * contano: solo anno/mese/giorno locali.
 */

export function toDateOnlyIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Giorni inclusivi tra due date di calendario (UTC), es. 24→27 marzo = 4 giorni. */
export function inclusiveCalendarDaysBetweenUtc(
  start: Date,
  end: Date,
): number {
  const s = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

/** Aggiunge giorni sul calendario UTC (indipendente dal fuso del processo Node). */
export function addCalendarDaysUtc(d: Date, deltaDays: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day + deltaDays));
}

const DOW_IT = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
] as const;

/** Restituisce il nome italiano del giorno della settimana (calendario UTC). */
export function dayOfWeekItalian(d: Date): string {
  return DOW_IT[d.getUTCDay()];
}
