"use client";

import { AlertTriangle, Leaf } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  dietFitStatus,
  requiredDietFits,
  selectedAllergies,
  type DietFitKey,
  type TripPreferences,
} from "@/lib/trip/preferences";

/** Etichetta per il testo: "Vegetariano, Senza glutine". */
function useDietNames() {
  const t = useTranslations("app.trips.preferences");
  return (keys: readonly string[]) =>
    keys.map((k) => t(`dietary.options.${k}`)).join(", ");
}

/**
 * Su un ristorante mostra se soddisfa le restrizioni scelte dall'utente, in
 * base a ciò che l'itinerario dichiara (`dietaryFit`). Quelle non confermate
 * sono segnalate "da verificare" invece di essere date per buone.
 */
export function RestaurantDietBadges({
  prefs,
  dietaryFit,
}: {
  prefs: TripPreferences;
  dietaryFit: readonly DietFitKey[];
}) {
  const t = useTranslations("app.trips.preferences");
  const names = useDietNames();
  const required = requiredDietFits(prefs);
  if (required.length === 0) return null;

  const { met, missing } = dietFitStatus(dietaryFit, required);

  return (
    <div
      className="mt-2 flex flex-wrap gap-2"
      data-testid="restaurant-diet-badges"
    >
      {met.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200/90">
          <Leaf className="h-3 w-3" aria-hidden />
          {t("restaurant.fit", { diets: names(met) })}
        </span>
      ) : null}
      {missing.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100/90">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {t("restaurant.unverified", { diets: names(missing) })}
        </span>
      ) : null}
    </div>
  );
}

/** Avviso fisso (non generato dall'AI) per chi ha indicato un'allergia: la verifica spetta sempre al locale. */
export function AllergyNotice({ prefs }: { prefs: TripPreferences }) {
  const t = useTranslations("app.trips.preferences");
  const names = useDietNames();
  const allergies = selectedAllergies(prefs);
  if (allergies.length === 0) return null;

  return (
    <p
      className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-100/90"
      role="note"
      data-testid="allergy-notice"
    >
      {t("restaurant.allergyNotice", { allergies: names(allergies) })}
    </p>
  );
}
