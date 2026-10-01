/**
 * Generazione a blocchi dei viaggi lunghi: ogni chiamata al modello genera al
 * massimo `GENERATION_CHUNK_DAYS` giorni. Una chiamata è uno step Inngest, cioè
 * una richiesta alla route `/api/inngest`, che ha un limite di 300 s. Misurato
 * con l'API reale: ~2,5 minuti per 3 giorni.
 */
export const GENERATION_CHUNK_DAYS = 4;

/** Giorni del viaggio generati in una chiamata (numerati da 1, estremi inclusi). */
export type DayRange = { firstDay: number; lastDay: number };

/**
 * Blocchi bilanciati: lo stesso numero di chiamate dei blocchi pieni, con i
 * giorni distribuiti in modo uniforme (9 → 3+3+3 invece di 4+4+1, 10 → 4+3+3).
 */
export function generationChunks(numDays: number): DayRange[] {
  if (!Number.isInteger(numDays) || numDays < 1) {
    throw new RangeError(`Numero di giorni non valido: ${numDays}`);
  }
  const count = Math.ceil(numDays / GENERATION_CHUNK_DAYS);
  const base = Math.floor(numDays / count);
  const extra = numDays % count;

  const chunks: DayRange[] = [];
  let firstDay = 1;
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0);
    chunks.push({ firstDay, lastDay: firstDay + size - 1 });
    firstDay += size;
  }
  return chunks;
}
