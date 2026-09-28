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
  return destination
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 120);
}
