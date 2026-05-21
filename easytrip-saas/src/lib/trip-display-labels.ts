/** DB `trip_type` → chiave sotto `app.trips.shared.tripType`. */
const TRIP_TYPE_DB_TO_KEY: Record<string, "solo" | "couple" | "group"> = {
  solo: "solo",
  coppia: "couple",
  gruppo: "group",
};

const TRIP_STATUS_KEYS = [
  "pending",
  "active",
  "expired",
  "cancelled",
] as const;

type TripTypeKey = "solo" | "couple" | "group";
type TripStatusKey = (typeof TRIP_STATUS_KEYS)[number];

type SharedTripTranslator = (
  key: `tripType.${TripTypeKey}` | `tripStatus.${TripStatusKey}`,
) => string;

/** Etichetta tipo viaggio localizzata (valori DB: solo, coppia, gruppo). */
export function tripTypeDisplayLabel(
  dbValue: string,
  t: SharedTripTranslator,
): string {
  const key = TRIP_TYPE_DB_TO_KEY[dbValue];
  if (!key) return dbValue;
  return t(`tripType.${key}`);
}

/** Etichetta stato viaggio localizzata. */
export function tripStatusDisplayLabel(
  dbValue: string,
  t: SharedTripTranslator,
): string {
  if ((TRIP_STATUS_KEYS as readonly string[]).includes(dbValue)) {
    return t(`tripStatus.${dbValue as TripStatusKey}`);
  }
  return dbValue;
}

/** Locale app (it, en, …) → tag BCP 47 per `toLocaleDateString`. */
export function localeToBcp47(locale: string): string {
  const map: Record<string, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
  };
  return map[locale] ?? "it-IT";
}
