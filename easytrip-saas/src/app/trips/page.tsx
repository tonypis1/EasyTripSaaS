import { redirect } from "next/navigation";

/**
 * Molti utenti aprono /trips per errore.
 * L’area autenticata è sotto /app → elenco viaggi = /app/trips.
 */
export default function TripsAliasRedirect() {
  redirect("/app/trips");
}
