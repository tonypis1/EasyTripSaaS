import { describe, expect, it } from "vitest";
import {
  buildIcsCalendar,
  buildTripIcsCalendar,
  buildTripIcsEvents,
  icsFilenameForDestination,
  type TripDayForIcs,
  slotEndDate,
} from "@/lib/ics-export";

function slotFixture(overrides: Record<string, unknown> = {}) {
  return {
    title: "Colosseo",
    place: "Rione Monti",
    why: "Simbolo di Roma",
    startTime: "09:00",
    endTime: "11:30",
    googleMapsQuery: "Colosseo Roma",
    lat: 41.8902,
    lng: 12.4922,
    ...overrides,
  };
}

describe("buildIcsCalendar", () => {
  it("produce un VCALENDAR RFC 5545 valido con le proprietà di base", () => {
    const ics = buildIcsCalendar({
      calendarName: "EasyTrip — Roma",
      events: [
        {
          uid: "day1-morning@easytripsaas.com",
          summary: "Colosseo",
          startDate: "2026-06-01",
          startTime: "09:00",
          endTime: "11:30",
        },
      ],
      now: new Date("2026-05-01T10:00:00.000Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:day1-morning@easytripsaas.com");
    expect(ics).toContain("DTSTART:20260601T090000");
    expect(ics).toContain("DTEND:20260601T113000");
    expect(ics).toContain("DTSTAMP:20260501T100000Z");
    expect(ics).toContain("SUMMARY:Colosseo");
    // Terminatori di riga CRLF richiesti da RFC 5545.
    expect(ics).toContain("\r\n");
  });

  it("genera un evento tutto-il-giorno (DTEND = giorno successivo) quando manca l'orario", () => {
    const ics = buildIcsCalendar({
      calendarName: "Test",
      events: [
        {
          uid: "allday@easytripsaas.com",
          summary: "Giorno libero",
          startDate: "2026-06-01",
        },
      ],
    });

    expect(ics).toContain("DTSTART;VALUE=DATE:20260601");
    expect(ics).toContain("DTEND;VALUE=DATE:20260602");
  });

  it("effettua l'escaping dei caratteri speciali (virgole, punto e virgola, newline)", () => {
    const ics = buildIcsCalendar({
      calendarName: "Test",
      events: [
        {
          uid: "x@easytripsaas.com",
          summary: "Pranzo, cena; relax\nrilassante",
          startDate: "2026-06-01",
        },
      ],
    });

    expect(ics).toContain("SUMMARY:Pranzo\\, cena\\; relax\\nrilassante");
  });

  it("include GEO solo quando lat/lng sono presenti", () => {
    const withGeo = buildIcsCalendar({
      calendarName: "Test",
      events: [
        {
          uid: "a@easytripsaas.com",
          summary: "A",
          startDate: "2026-06-01",
          lat: 41.9,
          lng: 12.45,
        },
      ],
    });
    expect(withGeo).toContain("GEO:41.9;12.45");

    const withoutGeo = buildIcsCalendar({
      calendarName: "Test",
      events: [
        { uid: "b@easytripsaas.com", summary: "B", startDate: "2026-06-01" },
      ],
    });
    expect(withoutGeo).not.toContain("GEO:");
  });

  function icsWithDescription(description: string) {
    return buildIcsCalendar({
      calendarName: "Test",
      events: [
        {
          uid: "a@easytripsaas.com",
          summary: "A",
          description,
          startDate: "2026-06-01",
        },
      ],
    });
  }

  const octets = (line: string) => new TextEncoder().encode(line).length;
  const unfold = (ics: string) => ics.replace(/\r\n /g, "");

  it("va a capo (fold) le righe oltre 75 ottetti con un singolo spazio iniziale, senza perdere testo", () => {
    const ics = icsWithDescription("x".repeat(200));

    const lines = ics.split("\r\n");
    expect(lines.filter((l) => l.startsWith(" ")).length).toBeGreaterThan(0);
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
    expect(unfold(ics)).toContain(`DESCRIPTION:${"x".repeat(200)}`);
  });

  it("conta gli ottetti UTF-8 e non spezza mai un carattere (emoji, ideogrammi, accenti)", () => {
    const text = "東京タワー🗼 è bellissima ".repeat(12);
    const ics = icsWithDescription(text);

    for (const line of ics.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
      // Nessun surrogato isolato: ogni riga è UTF-8 valido da sola.
      expect(line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(line).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
    expect(unfold(ics)).toContain(`DESCRIPTION:${text.replace(/,/g, "\\,")}`);
  });

  it("uno slot che passa la mezzanotte finisce il giorno dopo (mai DTEND prima di DTSTART)", () => {
    const ics = buildIcsCalendar({
      calendarName: "Test",
      events: [
        {
          uid: "n@easytripsaas.com",
          summary: "Locali",
          startDate: "2026-10-05",
          startTime: "22:00",
          endTime: "01:00",
        },
      ],
    });

    expect(ics).toContain("DTSTART:20261005T220000");
    expect(ics).toContain("DTEND:20261006T010000");
  });

  it("slotEndDate: stesso giorno se la fine è dopo l'inizio, giorno dopo se prima (anche a fine mese)", () => {
    expect(slotEndDate("2026-10-05", "09:00", "11:30")).toBe("2026-10-05");
    expect(slotEndDate("2026-10-31", "23:00", "00:30")).toBe("2026-11-01");
    expect(slotEndDate("2026-10-05", "10:00", "10:00")).toBe("2026-10-05");
  });
});

describe("buildTripIcsEvents", () => {
  it("crea un evento per ogni slot valido (morning/afternoon/evening)", () => {
    const days: TripDayForIcs[] = [
      {
        id: "day1",
        unlockDate: "2026-06-01",
        morning: slotFixture({ title: "Colosseo" }),
        afternoon: slotFixture({
          title: "Foro Romano",
          startTime: "14:00",
          endTime: "16:00",
        }),
        evening: slotFixture({
          title: "Trastevere",
          startTime: "19:00",
          endTime: "21:00",
        }),
      },
    ];

    const events = buildTripIcsEvents(days, "Roma");

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.summary)).toEqual([
      "Colosseo",
      "Foro Romano",
      "Trastevere",
    ]);
    expect(events[0].uid).toBe("day1-morning@easytripsaas.com");
    expect(events[0].location).toBe("Rione Monti, Roma");
    expect(events[0].lat).toBe(41.8902);
  });

  it("salta gli slot vuoti o non ancora generati ({}) senza lanciare eccezioni", () => {
    const days: TripDayForIcs[] = [
      {
        id: "day2",
        unlockDate: "2026-06-02",
        morning: "{}",
        afternoon: null,
        evening: "null",
      },
    ];

    expect(buildTripIcsEvents(days, "Roma")).toHaveLength(0);
  });

  it("salta uno slot con JSON malformato senza far fallire gli altri", () => {
    const days: TripDayForIcs[] = [
      {
        id: "day3",
        unlockDate: "2026-06-03",
        morning: "{not valid json",
        afternoon: slotFixture({ title: "Musei Vaticani" }),
        evening: null,
      },
    ];

    const events = buildTripIcsEvents(days, "Roma");
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Musei Vaticani");
  });

  it("include il link Google Maps nella descrizione quando googleMapsQuery è presente", () => {
    const days: TripDayForIcs[] = [
      {
        id: "day1",
        unlockDate: "2026-06-01",
        morning: slotFixture(),
        afternoon: null,
        evening: null,
      },
    ];

    const [event] = buildTripIcsEvents(days, "Roma");
    expect(event.description).toContain(
      "https://www.google.com/maps/search/?api=1&query=Colosseo%20Roma",
    );
  });
});

describe("buildTripIcsCalendar", () => {
  it("produce un file .ics completo e valido per l'intero trip", () => {
    const days: TripDayForIcs[] = [
      {
        id: "day1",
        unlockDate: "2026-06-01",
        morning: slotFixture(),
        afternoon: null,
        evening: null,
      },
    ];

    const ics = buildTripIcsCalendar("Roma", days);
    expect(ics).toContain("X-WR-CALNAME:EasyTrip — Roma");
    expect(ics).toContain("SUMMARY:Colosseo");
  });
});

describe("icsFilenameForDestination", () => {
  it("genera uno slug ASCII sicuro rimuovendo diacritici", () => {
    expect(icsFilenameForDestination("São Paulo")).toBe(
      "easytrip-sao-paulo.ics",
    );
    expect(icsFilenameForDestination("Città del Messico")).toBe(
      "easytrip-citta-del-messico.ics",
    );
  });

  it("usa un fallback quando la destinazione non produce caratteri validi", () => {
    expect(icsFilenameForDestination("!!!")).toBe("easytrip-viaggio.ics");
  });
});
