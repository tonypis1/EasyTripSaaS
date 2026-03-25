/**
 * Flag solo per sviluppo locale: mostra l’itinerario anche prima dello sblocco orario.
 * In produzione (`NODE_ENV === "production"`) non ha effetto, anche se la variabile è impostata.
 */
export const DEV_PREVIEW_UNLOCK_CONTENT =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_PREVIEW_UNLOCKED === "true";
