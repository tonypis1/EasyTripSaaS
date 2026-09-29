import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ALLERGY_KEYS,
  DIETARY_KEYS,
  DIET_FIT_KEYS,
  EMPTY_PREFERENCES,
  INTEREST_KEYS,
  MAX_INTERESTS,
  buildPreferencesPromptBlock,
  findDietaryConflictSuspects,
  findDietaryGaps,
  formatDietaryGaps,
  hasPreferences,
  preferencesCreateShape,
  preferencesFromTrip,
  preferencesUpdateShape,
  requiredDietFits,
  selectedAllergies,
  type TripPreferences,
} from "@/lib/trip/preferences";

const createSchema = z.object(preferencesCreateShape);
const updateSchema = z.object(preferencesUpdateShape);

function prefs(overrides: Partial<TripPreferences> = {}): TripPreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

describe("schema di creazione", () => {
  it("tutto facoltativo: senza input le preferenze sono vuote", () => {
    expect(createSchema.parse({})).toEqual({
      interests: [],
      pace: null,
      mobilityNeeds: [],
      dietaryRestrictions: [],
    });
  });

  it("elimina i duplicati e ordina in modo canonico, non in ordine di click", () => {
    const parsed = createSchema.parse({
      interests: ["wellness", "history", "wellness", "art_museums"],
      dietaryRestrictions: ["gluten_free", "vegetarian", "gluten_free"],
    });

    expect(parsed.interests).toEqual(["art_museums", "history", "wellness"]);
    expect(parsed.dietaryRestrictions).toEqual(["vegetarian", "gluten_free"]);
  });

  it("le stesse scelte in ordine diverso danno lo stesso risultato (prompt cacheable)", () => {
    const a = createSchema.parse({ interests: ["nature", "history"] });
    const b = createSchema.parse({ interests: ["history", "nature"] });

    expect(a).toEqual(b);
  });

  it("rifiuta valori sconosciuti (nessun testo libero nei campi strutturati)", () => {
    expect(() => createSchema.parse({ interests: ["ufo_spotting"] })).toThrow();
    expect(() =>
      createSchema.parse({ dietaryRestrictions: ["carnivore"] }),
    ).toThrow();
    expect(() => createSchema.parse({ mobilityNeeds: ["jetpack"] })).toThrow();
    expect(() => createSchema.parse({ pace: "frenetic" })).toThrow();
  });

  it("limita gli interessi a un massimo", () => {
    const tooMany = INTEREST_KEYS.slice(0, MAX_INTERESTS + 1);
    expect(() => createSchema.parse({ interests: tooMany })).toThrow();
    expect(
      createSchema.parse({ interests: INTEREST_KEYS.slice(0, MAX_INTERESTS) })
        .interests,
    ).toHaveLength(MAX_INTERESTS);
  });

  it("accetta ogni chiave documentata", () => {
    expect(() =>
      createSchema.parse({
        interests: INTEREST_KEYS.slice(0, MAX_INTERESTS),
        pace: "packed",
        mobilityNeeds: [
          "limited_walking",
          "avoid_stairs",
          "wheelchair",
          "stroller",
        ],
        dietaryRestrictions: [...DIETARY_KEYS],
      }),
    ).not.toThrow();
  });

  it("rifiuta tipi errati (stringa al posto di lista)", () => {
    expect(() => createSchema.parse({ interests: "history" })).toThrow();
  });
});

describe("schema di aggiornamento", () => {
  it("campo omesso = invariato (undefined), non azzerato", () => {
    const parsed = updateSchema.parse({});

    expect(parsed.interests).toBeUndefined();
    expect(parsed.pace).toBeUndefined();
    expect(parsed.mobilityNeeds).toBeUndefined();
    expect(parsed.dietaryRestrictions).toBeUndefined();
  });

  it("lista vuota e pace null azzerano esplicitamente", () => {
    expect(updateSchema.parse({ interests: [], pace: null })).toEqual({
      interests: [],
      pace: null,
    });
  });
});

describe("preferencesFromTrip", () => {
  it("legge le colonne del Trip e ignora chiavi non più supportate", () => {
    expect(
      preferencesFromTrip({
        interests: ["history", "vecchia_chiave", "art_museums"],
        pace: "relaxed",
        mobilityNeeds: ["wheelchair", "boh"],
        dietaryRestrictions: ["vegan", "sconosciuta"],
      }),
    ).toEqual({
      interests: ["art_museums", "history"],
      pace: "relaxed",
      mobilityNeeds: ["wheelchair"],
      dietaryRestrictions: ["vegan"],
    });
  });

  it("righe precedenti alla funzione (campi assenti o null) → preferenze vuote", () => {
    expect(preferencesFromTrip({})).toEqual(EMPTY_PREFERENCES);
    expect(
      preferencesFromTrip({
        interests: null,
        pace: null,
        mobilityNeeds: null,
        dietaryRestrictions: null,
      }),
    ).toEqual(EMPTY_PREFERENCES);
    expect(preferencesFromTrip({ pace: "valore-strano" }).pace).toBeNull();
  });
});

describe("helper sulle preferenze", () => {
  it("hasPreferences", () => {
    expect(hasPreferences(EMPTY_PREFERENCES)).toBe(false);
    expect(hasPreferences(prefs({ pace: "relaxed" }))).toBe(true);
    expect(hasPreferences(prefs({ interests: ["nature"] }))).toBe(true);
    expect(hasPreferences(prefs({ mobilityNeeds: ["stroller"] }))).toBe(true);
    expect(hasPreferences(prefs({ dietaryRestrictions: ["halal"] }))).toBe(
      true,
    );
  });

  it("requiredDietFits esclude le allergie; selectedAllergies le isola", () => {
    const p = prefs({
      dietaryRestrictions: ["vegetarian", "nut_allergy", "gluten_free"],
    });

    expect(requiredDietFits(p)).toEqual(["vegetarian", "gluten_free"]);
    expect(selectedAllergies(p)).toEqual(["nut_allergy"]);
    expect(new Set([...DIET_FIT_KEYS, ...ALLERGY_KEYS])).toEqual(
      new Set(DIETARY_KEYS),
    );
  });
});

describe("findDietaryGaps", () => {
  const days = [
    {
      dayNumber: 1,
      restaurants: [
        { name: "Da Enzo", dietaryFit: ["vegetarian", "gluten_free"] },
        { name: "Steak Palace", dietaryFit: [] },
      ],
    },
    {
      dayNumber: 2,
      restaurants: [
        { name: "Verde", dietaryFit: ["vegan"] },
        { name: "Storico" }, // riga senza dietaryFit (formato precedente)
      ],
    },
  ];

  it("segnala i locali che non dichiarano tutte le restrizioni richieste", () => {
    expect(findDietaryGaps(days, ["vegetarian", "gluten_free"])).toEqual([
      {
        dayNumber: 1,
        restaurant: "Steak Palace",
        missing: ["vegetarian", "gluten_free"],
      },
      { dayNumber: 2, restaurant: "Verde", missing: ["gluten_free"] },
      {
        dayNumber: 2,
        restaurant: "Storico",
        missing: ["vegetarian", "gluten_free"],
      },
    ]);
  });

  it("un locale vegano soddisfa anche la richiesta vegetariana (ma non il contrario)", () => {
    expect(
      findDietaryGaps(days, ["vegetarian"]).map((g) => g.restaurant),
    ).toEqual(["Steak Palace", "Storico"]);
    expect(
      findDietaryGaps(
        [
          {
            dayNumber: 1,
            restaurants: [{ name: "V", dietaryFit: ["vegetarian"] }],
          },
        ],
        ["vegan"],
      ),
    ).toHaveLength(1);
  });

  it("senza restrizioni richieste non ci sono lacune", () => {
    expect(findDietaryGaps(days, [])).toEqual([]);
  });

  it("giorni senza ristoranti non generano lacune", () => {
    expect(findDietaryGaps([{ dayNumber: 1 }], ["halal"])).toEqual([]);
  });
});

describe("formatDietaryGaps", () => {
  const gap = (n: number) => ({
    dayNumber: n,
    restaurant: `Locale ${n}`,
    missing: ["vegan" as const],
  });

  it("elenca pochi esempi e indica quanti altri", () => {
    const text = formatDietaryGaps([1, 2, 3, 4, 5, 6].map(gap), 4);

    expect(text).toContain('giorno 1 "Locale 1" (manca: vegan)');
    expect(text).toContain('giorno 4 "Locale 4"');
    expect(text).not.toContain("Locale 5");
    expect(text).toContain("e altri 2");
    expect(text).toContain("dietaryFit");
  });

  it("senza eccedenze non aggiunge 'e altri'", () => {
    expect(formatDietaryGaps([gap(1)])).not.toContain("altri");
  });
});

describe("findDietaryConflictSuspects (telemetria, indipendente dal modello)", () => {
  const day = (name: string, cuisine = "") => [
    { dayNumber: 1, restaurants: [{ name, cuisine }] },
  ];

  it.each([
    ["Texas Steakhouse", ""],
    ["La Braceria", "cucina di carne"],
    ["Asador Etxebarri", "parrilla"],
    ["Chez Marcel", "boucherie"],
    ["Zum Fleischwolf", "Fleisch"],
    ["El Rincón", "meat & bbq"],
  ])("vegetariano: '%s' (%s) è sospetto", (name, cuisine) => {
    expect(
      findDietaryConflictSuspects(day(name, cuisine), ["vegetarian"]),
    ).toEqual([{ dayNumber: 1, restaurant: name, restriction: "vegetarian" }]);
  });

  it("non segnala locali normali né restrizioni non pertinenti", () => {
    expect(
      findDietaryConflictSuspects(day("Trattoria Da Enzo", "cucina romana"), [
        "vegetarian",
      ]),
    ).toEqual([]);
    expect(
      findDietaryConflictSuspects(day("Texas Steakhouse"), ["gluten_free"]),
    ).toEqual([]);
    expect(findDietaryConflictSuspects(day("Texas Steakhouse"), [])).toEqual(
      [],
    );
  });

  it("halal/kosher: locali incentrati sul maiale", () => {
    expect(
      findDietaryConflictSuspects(day("Casa della Porchetta"), ["halal"]),
    ).toHaveLength(1);
    expect(
      findDietaryConflictSuspects(day("Bar Jamón"), ["kosher"]),
    ).toHaveLength(1);
    expect(
      findDietaryConflictSuspects(day("Casa della Porchetta"), ["vegan"]),
    ).toHaveLength(0);
  });
});

describe("buildPreferencesPromptBlock", () => {
  it("senza preferenze non c'è blocco (il prompt resta identico a prima)", () => {
    expect(
      buildPreferencesPromptBlock(EMPTY_PREFERENCES, "itinerary"),
    ).toBeNull();
    expect(buildPreferencesPromptBlock(EMPTY_PREFERENCES, "slot")).toBeNull();
  });

  const full = prefs({
    interests: ["art_museums", "food_wine"],
    pace: "relaxed",
    mobilityNeeds: ["wheelchair"],
    dietaryRestrictions: ["vegetarian", "gluten_free", "nut_allergy"],
  });

  it("generazione: interessi, ritmo, mobilità, vincolo dietary con codici dietaryFit e allergie", () => {
    const block = buildPreferencesPromptBlock(full, "itinerary") ?? "";

    expect(block).toContain("PREFERENZE DEL VIAGGIATORE");
    expect(block).toContain("arte e musei; cibo e vino");
    expect(block).toContain("almeno una tappa coerente");
    expect(block).toContain("RILASSATO");
    expect(block).toContain("sedia a rotelle");
    expect(block).toContain(
      "VINCOLANTI per TUTTI i ristoranti: vegetariano, senza glutine",
    );
    expect(block).toContain('"dietaryFit"');
    expect(block).toContain("vegetarian, gluten_free");
    expect(block).toContain("allergia alla frutta a guscio");
    expect(block).toContain("non fare promesse di sicurezza");
  });

  it("sostituzione/live: stesse scelte ma senza contratto dietaryFit né 'distribuisci sui giorni'", () => {
    const block = buildPreferencesPromptBlock(full, "slot") ?? "";

    expect(block).toContain("arte e musei");
    expect(block).toContain("sedia a rotelle");
    expect(block).toContain(
      "Restrizioni alimentari: vegetariano, senza glutine",
    );
    expect(block).not.toContain("dietaryFit");
    expect(block).not.toContain("Distribuiscili sui giorni");
  });

  it("include solo le righe pertinenti", () => {
    const block =
      buildPreferencesPromptBlock(prefs({ pace: "packed" }), "itinerary") ?? "";

    expect(block).toContain("INTENSO");
    expect(block).not.toContain("Interessi");
    expect(block).not.toContain("mobilità");
    expect(block).not.toContain("Restrizioni");
  });

  it("solo allergie: nessun contratto dietaryFit (l'AI non può garantirle) ma cautela nel prompt", () => {
    const block =
      buildPreferencesPromptBlock(
        prefs({ dietaryRestrictions: ["shellfish_allergy"] }),
        "itinerary",
      ) ?? "";

    expect(block).not.toContain('"dietaryFit"');
    expect(block).toContain("allergia a crostacei e molluschi");
  });

  it("è deterministico: stesse scelte → stesso testo", () => {
    expect(buildPreferencesPromptBlock(full, "itinerary")).toBe(
      buildPreferencesPromptBlock({ ...full }, "itinerary"),
    );
  });
});
