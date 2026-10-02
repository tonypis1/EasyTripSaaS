import type { Prisma } from "@prisma/client";
import type { DaySlot, RestaurantEntry } from "@/lib/itinerary-model-schema";

/**
 * Lettura e scrittura di `Day.morning/afternoon/evening/restaurants`.
 *
 * Le colonne sono jsonb: Prisma restituisce già oggetti e li accetta già come
 * oggetti. NON passare `JSON.stringify(...)` in scrittura: Prisma lo
 * salverebbe come stringa JSON (doppia serializzazione) e lo slot risulterebbe
 * illeggibile. Qui vive l'unico punto in cui si costruiscono i valori da
 * scrivere e l'unico in cui si leggono in modo tollerante, al posto dei vari
 * `JSON.parse` sparsi (UI, .ics, GeoScore, prompt AI).
 */

/** Slot letto dal DB: oggetto con i campi di `DaySlotSchema`, ma senza garanzie (dati storici, modificati a mano). */
export type StoredSlot = Record<string, unknown>;

type SlotRead =
  | { status: "empty" }
  | { status: "unreadable" }
  | { status: "ok"; slot: StoredSlot };

const MAX_UNWRAP_PASSES = 2;

/**
 * Valore salvato → oggetto slot.
 *
 * Accetta anche una stringa JSON (fino a due livelli di serializzazione): è ciò
 * che la migrazione a jsonb lascia per le righe già doppiamente serializzate, e
 * ciò che passano fixture e dati non ancora convertiti. Vuoto = nessun
 * contenuto (null, `{}`, stringa bianca); illeggibile = c'è qualcosa ma non è
 * un oggetto (testo non JSON, scalare, array).
 */
function readSlot(value: unknown): SlotRead {
  let v = value;

  for (
    let pass = 0;
    pass < MAX_UNWRAP_PASSES && typeof v === "string";
    pass++
  ) {
    if (v.trim() === "") return { status: "empty" };
    try {
      v = JSON.parse(v);
    } catch {
      return { status: "unreadable" };
    }
  }

  if (v === null || v === undefined) return { status: "empty" };
  if (typeof v !== "object" || Array.isArray(v)) {
    return { status: "unreadable" };
  }
  if (Object.keys(v).length === 0) return { status: "empty" };
  return { status: "ok", slot: v as StoredSlot };
}

/** Slot come oggetto, o null se assente, vuoto o illeggibile. Non lancia mai. */
export function readStoredSlot(value: unknown): StoredSlot | null {
  const read = readSlot(value);
  return read.status === "ok" ? read.slot : null;
}

/** Lista salvata (es. `Day.restaurants`) come array, o null se assente o non è una lista. Non lancia mai. */
export function readStoredList(value: unknown): unknown[] | null {
  let v = value;
  for (
    let pass = 0;
    pass < MAX_UNWRAP_PASSES && typeof v === "string";
    pass++
  ) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return Array.isArray(v) ? v : null;
}

/** Riga di riepilogo di uno slot per i prompt AI (contesto degli altri slot del giorno). */
export function slotSummary(value: unknown, label: string): string {
  const read = readSlot(value);
  if (read.status === "empty") return `${label}: vuoto`;
  if (read.status === "unreadable") return `${label}: dati non leggibili`;

  const { title, place, startTime, endTime } = read.slot;
  return `${label}: "${title ?? "?"}" — ${place ?? "?"} (${startTime ?? "?"}–${endTime ?? "?"})`;
}

/**
 * Blocco di prompt con i luoghi già in programma negli ALTRI giorni del
 * viaggio (titoli unici, nell'ordine dei giorni), o null se non ce ne sono.
 * Senza, sostituzioni e suggerimenti live riproponevano luoghi già previsti in
 * un altro giorno (verificato con l'API reale).
 */
export function plannedElsewherePromptBlock(
  otherDays: { morning: unknown; afternoon: unknown; evening: unknown }[],
  max = 60,
): string | null {
  const titles = new Set<string>();
  for (const day of otherDays) {
    for (const value of [day.morning, day.afternoon, day.evening]) {
      const title = readStoredSlot(value)?.title;
      if (typeof title === "string" && title.trim()) titles.add(title.trim());
    }
  }
  if (titles.size === 0) return null;
  const list = [...titles]
    .slice(0, max)
    .map((title) => `- ${title}`)
    .join("\n");
  return `GIÀ IN PROGRAMMA NEGLI ALTRI GIORNI (non riproporli):\n${list}`;
}

/** Slot segnaposto quando il modello non ne restituisce uno: la giornata resta consultabile. */
export function fallbackSlot(label: string): DaySlot {
  return {
    title: label,
    place: "Da definire",
    why: "Contenuto in rigenerazione",
    startTime: "09:00",
    endTime: "11:00",
    durationMin: 120,
    googleMapsQuery: label,
    bookingLink: null,
    tips: ["Riprova la generazione tra poco"],
    lat: null,
    lng: null,
  };
}

/**
 * Contenuto di un giorno generato → campi jsonb di `Day`, pronti per
 * `prisma.day.create`. Gli oggetti vanno passati così come sono (mai
 * stringificati); senza ristoranti la colonna resta NULL.
 */
export function dayContentForDb(day: {
  morning?: DaySlot | null;
  afternoon?: DaySlot | null;
  evening?: DaySlot | null;
  restaurants?: RestaurantEntry[] | null;
}): {
  morning: Prisma.InputJsonValue;
  afternoon: Prisma.InputJsonValue;
  evening: Prisma.InputJsonValue;
  restaurants: Prisma.InputJsonValue | undefined;
} {
  return {
    morning: day.morning ?? fallbackSlot("Mattina libera"),
    afternoon: day.afternoon ?? fallbackSlot("Pomeriggio libero"),
    evening: day.evening ?? fallbackSlot("Serata libera"),
    restaurants:
      day.restaurants && day.restaurants.length > 0
        ? day.restaurants
        : undefined,
  };
}
