import { describe, expect, it } from "vitest";
import { DaySlotSchema } from "@/lib/itinerary-model-schema";
import {
  dayContentForDb,
  fallbackSlot,
  readStoredList,
  readStoredSlot,
  slotSummary,
} from "@/lib/trip/day-slots";

const slot = {
  title: "Colosseo",
  place: "Rione Monti",
  why: "Simbolo",
  startTime: "09:00",
  endTime: "11:30",
  durationMin: 150,
  googleMapsQuery: "Colosseo Roma",
  bookingLink: null,
  tips: ["Presto"],
  lat: 41.8902,
  lng: 12.4922,
};

describe("readStoredSlot", () => {
  it("ritorna l'oggetto così com'è (jsonb)", () => {
    expect(readStoredSlot(slot)).toEqual(slot);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["oggetto vuoto", {}],
    ["stringa vuota", ""],
    ["stringa bianca", "   "],
    ["testo 'null'", "null"],
    ["testo '{}'", "{}"],
  ])("nessun contenuto: %s → null", (_label, value) => {
    expect(readStoredSlot(value)).toBeNull();
  });

  it.each([
    ["testo non JSON", "Mattina libera"],
    ["JSON troncato", '{"title": "Colosseo"'],
    ["numero jsonb", 42],
    ["booleano", true],
    ["array jsonb", [1, 2]],
    ["testo che è JSON scalare", "42"],
    ["testo che è un array JSON", "[1,2]"],
  ])("contenuto illeggibile: %s → null, senza lanciare", (_label, value) => {
    expect(readStoredSlot(value)).toBeNull();
  });

  it("legge una stringa JSON (righe non ancora convertite, fixture)", () => {
    expect(readStoredSlot(JSON.stringify(slot))).toEqual(slot);
  });

  it("recupera uno slot doppiamente serializzato (JSON.stringify di una stringa JSON)", () => {
    expect(readStoredSlot(JSON.stringify(JSON.stringify(slot)))).toEqual(slot);
  });

  it("non si spinge oltre due livelli di serializzazione", () => {
    const triple = JSON.stringify(JSON.stringify(JSON.stringify(slot)));
    expect(readStoredSlot(triple)).toBeNull();
  });
});

describe("readStoredList", () => {
  const list = [{ meal: "pranzo", name: "Da Enzo" }];

  it("ritorna l'array (jsonb) e legge anche stringhe JSON, anche doppie", () => {
    expect(readStoredList(list)).toEqual(list);
    expect(readStoredList(JSON.stringify(list))).toEqual(list);
    expect(readStoredList(JSON.stringify(JSON.stringify(list)))).toEqual(list);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["oggetto", { a: 1 }],
    ["numero", 3],
    ["testo non JSON", "ristoranti"],
    ["testo 'null'", "null"],
  ])("non è una lista: %s → null", (_label, value) => {
    expect(readStoredList(value)).toBeNull();
  });

  it("una lista vuota resta una lista vuota (la decisione spetta al chiamante)", () => {
    expect(readStoredList([])).toEqual([]);
  });
});

describe("slotSummary", () => {
  it("riassume uno slot leggibile", () => {
    expect(slotSummary(slot, "Mattina")).toBe(
      'Mattina: "Colosseo" — Rione Monti (09:00–11:30)',
    );
  });

  it("usa '?' per i campi mancanti", () => {
    expect(slotSummary({ title: "Solo titolo" }, "Sera")).toBe(
      'Sera: "Solo titolo" — ? (?–?)',
    );
  });

  it("distingue vuoto da illeggibile", () => {
    for (const empty of [null, undefined, {}, "", "{}", "null"]) {
      expect(slotSummary(empty, "Mattina")).toBe("Mattina: vuoto");
    }
    for (const bad of ["{non json", "testo libero", 42, [1]]) {
      expect(slotSummary(bad, "Mattina")).toBe("Mattina: dati non leggibili");
    }
  });

  it("accetta anche la stringa JSON storica", () => {
    expect(slotSummary(JSON.stringify(slot), "Pomeriggio")).toBe(
      'Pomeriggio: "Colosseo" — Rione Monti (09:00–11:30)',
    );
  });
});

describe("fallbackSlot / dayContentForDb", () => {
  it("il segnaposto è uno slot valido per lo schema", () => {
    expect(() =>
      DaySlotSchema.parse(fallbackSlot("Mattina libera")),
    ).not.toThrow();
    expect(fallbackSlot("Sera libera")).toMatchObject({
      title: "Sera libera",
      lat: null,
      lng: null,
    });
  });

  it("passa gli slot come oggetti, mai come stringhe (colonne jsonb)", () => {
    const content = dayContentForDb({
      morning: slot,
      afternoon: slot,
      evening: slot,
      restaurants: [
        {
          meal: "pranzo",
          name: "Da Enzo",
          cuisine: "romana",
          why: "Cacio e pepe",
          budgetHint: "€12-16",
          distance: "100m",
          reservationNeeded: true,
          reservationTip: "Prenota",
          dietaryFit: [],
        },
      ],
    });

    expect(content.morning).toBe(slot);
    for (const value of Object.values(content)) {
      expect(typeof value).toBe("object");
    }
    expect(Array.isArray(content.restaurants)).toBe(true);
  });

  it("sostituisce gli slot mancanti con un segnaposto etichettato", () => {
    const content = dayContentForDb({ morning: slot });

    expect(content.morning).toBe(slot);
    expect(content.afternoon).toMatchObject({ title: "Pomeriggio libero" });
    expect(content.evening).toMatchObject({ title: "Serata libera" });
  });

  it("senza ristoranti la colonna resta NULL (undefined, non [] né 'null')", () => {
    expect(dayContentForDb({}).restaurants).toBeUndefined();
    expect(dayContentForDb({ restaurants: [] }).restaurants).toBeUndefined();
    expect(dayContentForDb({ restaurants: null }).restaurants).toBeUndefined();
  });
});
