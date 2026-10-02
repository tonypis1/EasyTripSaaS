/**
 * Chiave di lookup condivisa tra utenti per la cache di grounding: "Roma",
 * "roma " e "ROMA" devono colpire la stessa riga. Unicode-aware (\p{L}\p{N})
 * per non collassare destinazioni non latine ("東京") in una chiave vuota, che
 * mescolerebbe destinazioni diverse nella stessa riga di cache.
 *
 * Ritorna "" se la destinazione non contiene lettere/numeri: il chiamante
 * deve saltare il grounding invece di usare una chiave vuota.
 */
export function normalizeDestinationKey(destination: string): string {
  return normalizePlaceName(destination).slice(0, 120);
}

/** Minuscolo, senza diacritici né punteggiatura: "Trattoria Da Enzo al 29" ~ "trattoria da enzo al 29". */
export function normalizePlaceName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
