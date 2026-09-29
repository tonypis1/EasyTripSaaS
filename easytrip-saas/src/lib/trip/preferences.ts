import { z } from "zod";

/**
 * Preferenze strutturate del viaggio (interessi, ritmo, mobilità, restrizioni
 * alimentari): sostituiscono il solo campo libero `style` come segnale per
 * l'AI. Modulo puro, condiviso tra validazione server, UI (chiavi e limiti) e
 * costruzione dei prompt.
 *
 * Privacy: le restrizioni alimentari (halal, kosher, celiachia, allergie…)
 * possono rivelare convinzioni religiose o dati sulla salute. Sono facoltative,
 * servono solo a costruire l'itinerario e NON vanno inviate ad analytics né nei
 * log (solo conteggi).
 */

export const INTEREST_KEYS = [
  "art_museums",
  "history",
  "food_wine",
  "nature",
  "architecture",
  "nightlife",
  "shopping",
  "local_life",
  "adventure",
  "wellness",
] as const;
export type InterestKey = (typeof INTEREST_KEYS)[number];
export const MAX_INTERESTS = 6;

export const PACE_KEYS = ["relaxed", "balanced", "packed"] as const;
export type PaceKey = (typeof PACE_KEYS)[number];

export const MOBILITY_KEYS = [
  "limited_walking",
  "avoid_stairs",
  "wheelchair",
  "stroller",
] as const;
export type MobilityKey = (typeof MOBILITY_KEYS)[number];

/** Diete che un locale può soddisfare: il modello dichiara `dietaryFit` per ogni ristorante. */
export const DIET_FIT_KEYS = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
  "halal",
  "kosher",
] as const;
export type DietFitKey = (typeof DIET_FIT_KEYS)[number];

/** Allergie: l'AI non può garantirne la sicurezza, quindi niente "compatibilità" dichiarata, solo cautela e avviso in UI. */
export const ALLERGY_KEYS = ["nut_allergy", "shellfish_allergy"] as const;
export type AllergyKey = (typeof ALLERGY_KEYS)[number];

export const DIETARY_KEYS = [...DIET_FIT_KEYS, ...ALLERGY_KEYS] as const;
export type DietaryKey = (typeof DIETARY_KEYS)[number];

export type TripPreferences = {
  interests: InterestKey[];
  pace: PaceKey | null;
  mobilityNeeds: MobilityKey[];
  dietaryRestrictions: DietaryKey[];
};

export const EMPTY_PREFERENCES: TripPreferences = {
  interests: [],
  pace: null,
  mobilityNeeds: [],
  dietaryRestrictions: [],
};

/**
 * Lista di valori ammessi, senza duplicati e in ordine canonico (non in ordine
 * di click): il prompt risulta identico per le stesse scelte, quindi resta
 * cacheable, e il confronto "è cambiato?" non dipende dall'ordine.
 */
function canonicalList<T extends string>(
  order: readonly [T, ...T[]],
  max: number,
) {
  return z
    .array(z.enum(order))
    .max(max)
    .transform((values) => order.filter((key) => values.includes(key)));
}

/** Campi preferenze alla creazione del viaggio: tutti facoltativi, vuoti di default. */
export const preferencesCreateShape = {
  interests: canonicalList(INTEREST_KEYS, MAX_INTERESTS).default([]),
  pace: z.enum(PACE_KEYS).nullable().default(null),
  mobilityNeeds: canonicalList(MOBILITY_KEYS, MOBILITY_KEYS.length).default([]),
  dietaryRestrictions: canonicalList(DIETARY_KEYS, DIETARY_KEYS.length).default(
    [],
  ),
};

/**
 * Campi preferenze in aggiornamento: omesso = invariato, `[]`/`null` = azzera.
 */
export const preferencesUpdateShape = {
  interests: canonicalList(INTEREST_KEYS, MAX_INTERESTS).optional(),
  pace: z.enum(PACE_KEYS).nullable().optional(),
  mobilityNeeds: canonicalList(MOBILITY_KEYS, MOBILITY_KEYS.length).optional(),
  dietaryRestrictions: canonicalList(
    DIETARY_KEYS,
    DIETARY_KEYS.length,
  ).optional(),
};

function knownKeys<T extends string>(
  order: readonly T[],
  stored: readonly string[] | null | undefined,
): T[] {
  const set = new Set(stored ?? []);
  return order.filter((key) => set.has(key));
}

/**
 * Preferenze dai campi salvati sul Trip. Tollerante: chiavi non più supportate
 * (o righe precedenti alla funzione) vengono ignorate invece di dare errore.
 */
export function preferencesFromTrip(trip: {
  interests?: readonly string[] | null;
  pace?: string | null;
  mobilityNeeds?: readonly string[] | null;
  dietaryRestrictions?: readonly string[] | null;
}): TripPreferences {
  return {
    interests: knownKeys(INTEREST_KEYS, trip.interests),
    pace: PACE_KEYS.find((p) => p === trip.pace) ?? null,
    mobilityNeeds: knownKeys(MOBILITY_KEYS, trip.mobilityNeeds),
    dietaryRestrictions: knownKeys(DIETARY_KEYS, trip.dietaryRestrictions),
  };
}

export function hasPreferences(prefs: TripPreferences): boolean {
  return (
    prefs.interests.length > 0 ||
    prefs.pace !== null ||
    prefs.mobilityNeeds.length > 0 ||
    prefs.dietaryRestrictions.length > 0
  );
}

/** Restrizioni che un ristorante può soddisfare (esclude le allergie). */
export function requiredDietFits(prefs: TripPreferences): DietFitKey[] {
  return DIET_FIT_KEYS.filter((key) => prefs.dietaryRestrictions.includes(key));
}

export function selectedAllergies(prefs: TripPreferences): AllergyKey[] {
  return ALLERGY_KEYS.filter((key) => prefs.dietaryRestrictions.includes(key));
}

/** Un locale vegano soddisfa anche chi cerca vegetariano. */
function satisfies(declared: readonly string[], required: DietFitKey): boolean {
  if (declared.includes(required)) return true;
  return required === "vegetarian" && declared.includes("vegan");
}

/** Restrizioni soddisfatte e mancanti per un locale che dichiara `declared`. */
export function dietFitStatus(
  declared: readonly string[],
  required: readonly DietFitKey[],
): { met: DietFitKey[]; missing: DietFitKey[] } {
  const met = required.filter((need) => satisfies(declared, need));
  return { met, missing: required.filter((need) => !met.includes(need)) };
}

export type DietaryGap = {
  dayNumber: number;
  restaurant: string;
  missing: DietFitKey[];
};

/** Ristoranti che non dichiarano di soddisfare tutte le restrizioni richieste. */
export function findDietaryGaps(
  days: readonly {
    dayNumber: number;
    restaurants?: readonly { name: string; dietaryFit?: readonly string[] }[];
  }[],
  required: readonly DietFitKey[],
): DietaryGap[] {
  if (required.length === 0) return [];

  return days.flatMap((day) =>
    (day.restaurants ?? []).flatMap((restaurant) => {
      const { missing } = dietFitStatus(restaurant.dietaryFit ?? [], required);
      return missing.length > 0
        ? [{ dayNumber: day.dayNumber, restaurant: restaurant.name, missing }]
        : [];
    }),
  );
}

/** Motivo da passare al ciclo di riparazione (pochi esempi: il prompt di riparazione ha un limite). */
export function formatDietaryGaps(gaps: readonly DietaryGap[], limit = 4) {
  const examples = gaps
    .slice(0, limit)
    .map(
      (g) =>
        `giorno ${g.dayNumber} "${g.restaurant}" (manca: ${g.missing.join(", ")})`,
    )
    .join("; ");
  const more = gaps.length > limit ? ` e altri ${gaps.length - limit}` : "";
  return `Ristoranti che non soddisfano le restrizioni alimentari dell'utente nel campo "dietaryFit": ${examples}${more}. Sostituiscili con locali che soddisfano davvero TUTTE le restrizioni, oppure dichiara solo compatibilità reali.`;
}

/**
 * Indizi indipendenti dall'auto-dichiarazione del modello: nome o cucina che
 * indicano un locale incentrato proprio su ciò che l'utente non mangia.
 * Euristica prudente e multilingue, usata solo per telemetria (mai per
 * bloccare una generazione): serve a capire quanto ci si può fidare di
 * `dietaryFit`.
 */
const MEAT_CENTRIC =
  /\b(steak\s?house|bbq|barbecue|braceria|macelleria|carnivor\w*|churrasc\w*|asador|boucherie|metzgerei|carn[ei]s?|meat|viande|fleisch)\b/i;
const PORK_CENTRIC =
  /\b(porchetta|maiale|pork|cerdo|porc|schwein\w*|jam[oó]n|prosciutteria|salumeria)\b/i;

export type DietaryConflictSuspect = {
  dayNumber: number;
  restaurant: string;
  restriction: DietFitKey;
};

export function findDietaryConflictSuspects(
  days: readonly {
    dayNumber: number;
    restaurants?: readonly { name: string; cuisine?: string }[];
  }[],
  required: readonly DietFitKey[],
): DietaryConflictSuspect[] {
  const checks: [DietFitKey, RegExp][] = [
    ["vegetarian", MEAT_CENTRIC],
    ["vegan", MEAT_CENTRIC],
    ["halal", PORK_CENTRIC],
    ["kosher", PORK_CENTRIC],
  ];

  return days.flatMap((day) =>
    (day.restaurants ?? []).flatMap((restaurant) => {
      const text = `${restaurant.name} ${restaurant.cuisine ?? ""}`;
      return checks.flatMap(([restriction, pattern]) =>
        required.includes(restriction) && pattern.test(text)
          ? [
              {
                dayNumber: day.dayNumber,
                restaurant: restaurant.name,
                restriction,
              },
            ]
          : [],
      );
    }),
  );
}

const INTEREST_PROMPT: Record<InterestKey, string> = {
  art_museums: "arte e musei",
  history: "storia e siti storici",
  food_wine: "cibo e vino",
  nature: "natura e attività all'aperto",
  architecture: "architettura",
  nightlife: "vita notturna",
  shopping: "shopping",
  local_life: "vita locale e mercati",
  adventure: "sport e avventura",
  wellness: "relax e benessere",
};

const PACE_PROMPT: Record<PaceKey, string> = {
  relaxed:
    "RILASSATO — al massimo un'attività principale per slot, durate lunghe (2–3 ore), pause e tempo libero, nessuna sveglia presto (primo slot non prima delle 9:30), spostamenti ridotti al minimo.",
  balanced:
    "EQUILIBRATO — mix di attività principali e tempo libero, ritmo moderato.",
  packed:
    "INTENSO — sfrutta ogni slot, orari di inizio anticipati (dalle 8:30), più tappe vicine tra loro nello stesso slot quando ha senso.",
};

const MOBILITY_PROMPT: Record<MobilityKey, string> = {
  limited_walking:
    "camminata ridotta — tappe consecutive vicine (al massimo circa 1 km), poche salite ripide, suggerisci mezzi pubblici o taxi per le tratte più lunghe",
  avoid_stairs:
    "evitare scale — niente luoghi raggiungibili solo con molte scalinate (torri, panorami a piedi, catacombe)",
  wheelchair:
    'sedia a rotelle — solo luoghi con ingresso senza gradini o con rampe/ascensore, evita ciottolato irregolare e strade ripide; nei consigli ("tips") indica come verificare l\'accessibilità (sito ufficiale o telefono)',
  stroller:
    "passeggino — luoghi percorribili con il passeggino, evita scalinate e ciottolato, preferisci parchi e musei con ascensore",
};

const DIETARY_PROMPT: Record<DietaryKey, string> = {
  vegetarian: "vegetariano",
  vegan: "vegano",
  gluten_free: "senza glutine",
  lactose_free: "senza lattosio",
  halal: "halal",
  kosher: "kosher",
  nut_allergy: "allergia alla frutta a guscio",
  shellfish_allergy: "allergia a crostacei e molluschi",
};

/**
 * Blocco di prompt con le preferenze scelte dall'utente, o null se non ce ne
 * sono (il prompt resta identico a prima). `itinerary` = generazione completa,
 * con il contratto `dietaryFit` sui ristoranti; `slot` = sostituzione di uno
 * slot / suggerimento live, dove le alternative devono rispettare le stesse
 * scelte ma non c'è un elenco di ristoranti da compilare.
 */
export function buildPreferencesPromptBlock(
  prefs: TripPreferences,
  scope: "itinerary" | "slot",
): string | null {
  if (!hasPreferences(prefs)) return null;

  const lines: string[] = [];

  if (prefs.interests.length > 0) {
    lines.push(
      `- Interessi: ${prefs.interests.map((k) => INTEREST_PROMPT[k]).join("; ")}.${
        scope === "itinerary"
          ? " Distribuiscili sui giorni: ogni giornata deve includere almeno una tappa coerente con almeno uno di questi interessi."
          : ""
      }`,
    );
  }

  if (prefs.pace) {
    lines.push(`- Ritmo: ${PACE_PROMPT[prefs.pace]}`);
  }

  if (prefs.mobilityNeeds.length > 0) {
    lines.push(
      `- Esigenze di mobilità (vincolanti per ogni tappa): ${prefs.mobilityNeeds.map((k) => MOBILITY_PROMPT[k]).join("; ")}.`,
    );
  }

  const fits = requiredDietFits(prefs);
  if (fits.length > 0) {
    const names = fits.map((k) => DIETARY_PROMPT[k]).join(", ");
    lines.push(
      scope === "itinerary"
        ? `- Restrizioni alimentari — VINCOLANTI per TUTTI i ristoranti: ${names}. Per ogni ristorante compila "dietaryFit" con i codici delle restrizioni che soddisfa davvero (${fits.join(", ")}): piatti principali adatti, non solo contorni; indica nel campo "why" il piatto o l'opzione adatta. Non proporre locali incentrati proprio su ciò che l'utente non può mangiare (es. una steakhouse per un vegetariano). Non dichiarare una compatibilità di cui non sei sicuro: è meglio scegliere un altro locale.`
        : `- Restrizioni alimentari: ${names}. Se proponi un posto dove mangiare, deve soddisfarle davvero.`,
    );
  }

  const allergies = selectedAllergies(prefs);
  if (allergies.length > 0) {
    lines.push(
      `- Allergie dichiarate: ${allergies.map((k) => DIETARY_PROMPT[k]).join(", ")}. Evita locali specializzati nell'allergene e non fare promesse di sicurezza nei testi: la verifica spetta al locale.`,
    );
  }

  return [
    "SEZIONE — PREFERENZE DEL VIAGGIATORE (scelte esplicite dell'utente: prevalgono sui tuoi gusti generici)",
    ...lines,
  ].join("\n");
}
