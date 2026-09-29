"use client";

import { useTranslations } from "next-intl";
import {
  DIETARY_KEYS,
  INTEREST_KEYS,
  MAX_INTERESTS,
  MOBILITY_KEYS,
  PACE_KEYS,
  selectedAllergies,
  type TripPreferences,
} from "@/lib/trip/preferences";

type Props = {
  value: TripPreferences;
  onChange: (next: TripPreferences) => void;
  disabled?: boolean;
};

/** Numero di scelte fatte (per il riepilogo della sezione richiudibile). */
export function countPreferences(prefs: TripPreferences): number {
  return (
    prefs.interests.length +
    (prefs.pace ? 1 : 0) +
    prefs.mobilityNeeds.length +
    prefs.dietaryRestrictions.length
  );
}

function toggle<T extends string>(list: readonly T[], key: T): T[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

function Chip({
  selected,
  disabled,
  onClick,
  title,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={[
        "min-h-[36px] cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
        "focus:ring-et-accent/50 focus:ring-offset-et-deep focus:ring-2 focus:ring-offset-1 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        selected
          ? "border-et-accent bg-et-accent/15 text-et-accent"
          : "border-et-border bg-et-deep text-et-ink/65 hover:border-et-accent/30 hover:text-et-ink/85",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <legend className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase">
      {children}
    </legend>
  );
}

/**
 * Scelte strutturate del viaggio: interessi, ritmo, mobilità, restrizioni
 * alimentari. Componente controllato, usato sia alla creazione sia nel
 * pannello di modifica delle preferenze.
 */
export function PreferencesFields({ value, onChange, disabled }: Props) {
  const t = useTranslations("app.trips.preferences");
  const atMaxInterests = value.interests.length >= MAX_INTERESTS;
  const allergies = selectedAllergies(value);

  return (
    <div className="space-y-4" data-testid="preferences-fields">
      <fieldset>
        <Legend>
          {t("interests.label")}{" "}
          <span className="text-et-ink/40 font-normal tracking-normal normal-case">
            · {t("interests.hint", { max: MAX_INTERESTS })}
          </span>
        </Legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_KEYS.map((key) => {
            const selected = value.interests.includes(key);
            return (
              <Chip
                key={key}
                selected={selected}
                disabled={disabled || (!selected && atMaxInterests)}
                onClick={() =>
                  onChange({
                    ...value,
                    interests: toggle(value.interests, key),
                  })
                }
              >
                {t(`interests.options.${key}`)}
              </Chip>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Legend>{t("pace.label")}</Legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PACE_KEYS.map((key) => (
            <Chip
              key={key}
              selected={value.pace === key}
              disabled={disabled}
              title={t(`pace.hints.${key}`)}
              onClick={() =>
                onChange({ ...value, pace: value.pace === key ? null : key })
              }
            >
              {t(`pace.options.${key}`)}
            </Chip>
          ))}
        </div>
        {value.pace ? (
          <p className="text-et-ink/45 mt-1.5 text-xs">
            {t(`pace.hints.${value.pace}`)}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <Legend>{t("mobility.label")}</Legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOBILITY_KEYS.map((key) => (
            <Chip
              key={key}
              selected={value.mobilityNeeds.includes(key)}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  mobilityNeeds: toggle(value.mobilityNeeds, key),
                })
              }
            >
              {t(`mobility.options.${key}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <Legend>{t("dietary.label")}</Legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETARY_KEYS.map((key) => (
            <Chip
              key={key}
              selected={value.dietaryRestrictions.includes(key)}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  dietaryRestrictions: toggle(value.dietaryRestrictions, key),
                })
              }
            >
              {t(`dietary.options.${key}`)}
            </Chip>
          ))}
        </div>
        <p className="text-et-ink/45 mt-1.5 text-xs">{t("dietary.privacy")}</p>
        {allergies.length > 0 ? (
          <p
            className="mt-1.5 rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-100/90"
            role="note"
          >
            {t("dietary.allergyDisclaimer")}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
