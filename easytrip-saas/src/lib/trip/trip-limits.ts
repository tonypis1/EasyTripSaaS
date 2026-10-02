import {
  addCalendarDaysUtc,
  inclusiveCalendarDaysBetweenUtc,
  toDateOnlyIsoUtc,
} from "@/lib/calendar-date";

/**
 * Durata massima di un viaggio, in giorni di calendario (estremi inclusi).
 * 30 giorni sono 8 chiamate al modello (vedi `generation-chunks.ts`), già
 * ~25 minuti di generazione.
 */
export const MAX_TRIP_DAYS = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Giorni di calendario tra due date "YYYY-MM-DD" (estremi inclusi), o null se non valide. */
export function tripLengthDaysFromIso(
  startIso: string,
  endIso: string,
): number | null {
  if (!ISO_DATE.test(startIso) || !ISO_DATE.test(endIso)) return null;
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return inclusiveCalendarDaysBetweenUtc(start, end);
}

/** Ultima data di fine ammessa ("YYYY-MM-DD") per una data di inizio, o null se non valida. */
export function maxTripEndIso(startIso: string): string | null {
  if (!ISO_DATE.test(startIso)) return null;
  const start = new Date(`${startIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  return toDateOnlyIsoUtc(addCalendarDaysUtc(start, MAX_TRIP_DAYS - 1));
}
