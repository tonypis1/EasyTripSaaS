import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIETARY_KEYS,
  INTEREST_KEYS,
  MOBILITY_KEYS,
  PACE_KEYS,
} from "@/lib/trip/preferences";

/**
 * Le etichette delle opzioni si risolvono con chiavi dinamiche
 * (`interests.options.${key}`), che il controllo statico delle traduzioni non
 * può verificare: qui si garantisce che ogni opzione abbia un testo in ogni
 * lingua, così aggiungere una chiave a preferences.ts senza tradurla fa
 * fallire i test invece di mostrare una chiave grezza all'utente.
 */

const LOCALES = ["it", "en", "es", "fr", "de"] as const;

type Messages = { app: { trips: { preferences: Record<string, unknown> } } };

function load(locale: string): Messages["app"]["trips"]["preferences"] {
  const file = path.resolve(__dirname, `../../messages/${locale}.json`);
  return (JSON.parse(readFileSync(file, "utf8")) as Messages).app.trips
    .preferences;
}

function at(obj: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>(
    (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
    obj,
  );
}

describe.each(LOCALES)("preferenze: traduzioni %s", (locale) => {
  const messages = load(locale);

  const groups: [string, readonly string[], string[]][] = [
    ["interessi", INTEREST_KEYS, ["interests", "options"]],
    ["ritmo", PACE_KEYS, ["pace", "options"]],
    ["suggerimenti ritmo", PACE_KEYS, ["pace", "hints"]],
    ["mobilità", MOBILITY_KEYS, ["mobility", "options"]],
    ["restrizioni alimentari", DIETARY_KEYS, ["dietary", "options"]],
  ];

  it.each(groups)(
    "ogni opzione di %s ha un'etichetta non vuota",
    (_name, keys, where) => {
      for (const key of keys) {
        const label = at(messages, ...where, key);
        expect(typeof label, `${where.join(".")}.${key}`).toBe("string");
        expect((label as string).trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("non ci sono etichette senza una chiave corrispondente (nessun residuo)", () => {
    const options = (at(messages, "dietary", "options") ?? {}) as Record<
      string,
      string
    >;
    expect(Object.keys(options).sort()).toEqual([...DIETARY_KEYS].sort());
  });

  it("i testi con segnaposto li usano tutti (niente {diets}/{allergies}/{count}/{max} persi in traduzione)", () => {
    expect(at(messages, "restaurant", "fit")).toContain("{diets}");
    expect(at(messages, "restaurant", "unverified")).toContain("{diets}");
    expect(at(messages, "restaurant", "allergyNotice")).toContain(
      "{allergies}",
    );
    expect(at(messages, "selectedCount")).toContain("{count}");
    expect(at(messages, "interests", "hint")).toContain("{max}");
  });
});
