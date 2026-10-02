/**
 * Serializzazione di un itinerario EasyTrip in un file .ics (RFC 5545),
 * importabile in Google Calendar, Apple Calendar, Outlook, ecc.
 *
 * Zero costo AI, zero dipendenze esterne: pura trasformazione dei dati
 * `Day`/slot già persistiti (title, startTime/endTime, place, lat/lng).
 * Scope volutamente limitato ai 3 slot giornalieri (morning/afternoon/
 * evening), che hanno un orario reale — a differenza dei ristoranti, che
 * hanno solo "pranzo"/"cena" senza un orario fisso.
 *
 * Limite noto: gli orari sono "floating" (senza TZID), perché il viaggio non
 * memorizza il fuso della destinazione. Un calendario li mostra nel fuso del
 * dispositivo o dell'account: corretti sul posto con il telefono sul fuso
 * locale, spostati se il calendario resta sul fuso di casa (es. Google
 * Calendar web impostato su Roma durante un viaggio a Tokyo).
 */

import { readStoredSlot } from "@/lib/trip/day-slots";

const ICS_DOMAIN = "easytripsaas.com";
/** Lunghezza massima di una riga .ics in ottetti UTF-8, CRLF escluso (RFC 5545 §3.1). */
const ICS_FOLD_OCTETS = 75;
const utf8 = new TextEncoder();

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Line-folding RFC 5545: righe di al massimo 75 ottetti, le continuazioni
 * iniziano con uno spazio. Conta i byte UTF-8 (un carattere accentato ne vale
 * 2, un ideogramma 3, un'emoji 4) e taglia solo tra un carattere e l'altro:
 * mai a metà di una sequenza (un'emoji spezzata diventerebbe "\uFFFD").
 */
function foldIcsLine(line: string): string {
  if (utf8.encode(line).length <= ICS_FOLD_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = ICS_FOLD_OCTETS;
  for (const char of line) {
    const size = utf8.encode(char).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = ICS_FOLD_OCTETS - 1; // lo spazio iniziale della continuazione conta
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function formatIcsDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatIcsLocalDateTime(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(":");
  return `${formatIcsDateOnly(dateStr)}T${h.padStart(2, "0")}${(m ?? "00").padStart(2, "0")}00`;
}

/** Timestamp UTC per DTSTAMP/momento di generazione, es. 20260601T120000Z. */
function formatIcsUtcStamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function addDaysToDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutesOfDay(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Data (YYYY-MM-DD) in cui finisce uno slot: il giorno dopo se l'orario di
 * fine è prima di quello di inizio (es. 22:00–01:00). Senza, la fine cadrebbe
 * prima dell'inizio: evento non valido per RFC 5545 e per Google Calendar.
 */
export function slotEndDate(
  dateStr: string,
  startTime: string,
  endTime: string,
): string {
  return minutesOfDay(endTime) < minutesOfDay(startTime)
    ? addDaysToDateOnly(dateStr, 1)
    : dateStr;
}

export type IcsEvent = {
  /** Stabile tra export ripetuti dello stesso slot, per permettere update invece di duplicati negli import successivi. */
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:mm — assente ⇒ evento "tutto il giorno" (usa solo startDate). */
  startTime?: string | null;
  endTime?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function buildEventLines(event: IcsEvent, dtstamp: string): string[] {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (event.startTime) {
    lines.push(
      `DTSTART:${formatIcsLocalDateTime(event.startDate, event.startTime)}`,
    );
    const endTime = event.endTime ?? event.startTime;
    lines.push(
      `DTEND:${formatIcsLocalDateTime(slotEndDate(event.startDate, event.startTime, endTime), endTime)}`,
    );
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDateOnly(event.startDate)}`);
    lines.push(
      `DTEND;VALUE=DATE:${formatIcsDateOnly(addDaysToDateOnly(event.startDate, 1))}`,
    );
  }

  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.lat != null && event.lng != null) {
    lines.push(`GEO:${event.lat};${event.lng}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Costruisce un intero file .ics (VCALENDAR) da una lista di eventi già pronti. */
export function buildIcsCalendar(params: {
  calendarName: string;
  events: IcsEvent[];
  now?: Date;
}): string {
  const dtstamp = formatIcsUtcStamp(params.now ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EasyTrip//Itinerary Export//IT",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(params.calendarName)}`,
  ];

  for (const event of params.events) {
    lines.push(...buildEventLines(event, dtstamp));
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

type ParsedIcsSlot = {
  title: string;
  place: string;
  why: string;
  startTime: string;
  endTime: string;
  googleMapsQuery: string | null;
  lat: number | null;
  lng: number | null;
};

/** Validazione difensiva di uno slot salvato (vedi Day.morning/afternoon/evening): campi mancanti/malformati ⇒ null, mai un'eccezione. */
function parseSlotForIcs(value: unknown): ParsedIcsSlot | null {
  const o = readStoredSlot(value);
  if (!o) return null;
  if (
    typeof o.title !== "string" ||
    typeof o.place !== "string" ||
    typeof o.startTime !== "string" ||
    typeof o.endTime !== "string"
  ) {
    return null;
  }
  return {
    title: o.title,
    place: o.place,
    why: typeof o.why === "string" ? o.why : "",
    startTime: o.startTime,
    endTime: o.endTime,
    googleMapsQuery:
      typeof o.googleMapsQuery === "string" && o.googleMapsQuery.length > 0
        ? o.googleMapsQuery
        : null,
    lat: typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null,
    lng: typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null,
  };
}

const SLOT_KEYS = ["morning", "afternoon", "evening"] as const;
type SlotKey = (typeof SLOT_KEYS)[number];

export type TripDayForIcs = {
  id: string;
  unlockDate: string; // YYYY-MM-DD
  /** Slot come salvati (oggetto jsonb); qualunque forma illeggibile viene ignorata. */
  morning: unknown;
  afternoon: unknown;
  evening: unknown;
};

function buildSlotDescription(slot: ParsedIcsSlot): string | null {
  const parts: string[] = [];
  if (slot.why) parts.push(slot.why);
  if (slot.googleMapsQuery) {
    parts.push(
      `Apri in Google Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(slot.googleMapsQuery)}`,
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/** Converte le giornate di un trip (dati già persistiti) in eventi .ics: uno per ogni slot con un orario valido. */
export function buildTripIcsEvents(
  days: TripDayForIcs[],
  destination: string,
): IcsEvent[] {
  const events: IcsEvent[] = [];

  for (const day of days) {
    const slots: Record<SlotKey, unknown> = {
      morning: day.morning,
      afternoon: day.afternoon,
      evening: day.evening,
    };

    for (const key of SLOT_KEYS) {
      const slot = parseSlotForIcs(slots[key]);
      if (!slot) continue;

      events.push({
        uid: `${day.id}-${key}@${ICS_DOMAIN}`,
        summary: slot.title,
        description: buildSlotDescription(slot),
        location: `${slot.place}, ${destination}`,
        startDate: day.unlockDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        lat: slot.lat,
        lng: slot.lng,
      });
    }
  }

  return events;
}

export function buildTripIcsCalendar(
  destination: string,
  days: TripDayForIcs[],
): string {
  return buildIcsCalendar({
    calendarName: `EasyTrip — ${destination}`,
    events: buildTripIcsEvents(days, destination),
  });
}

/** Nome file scaricabile, slug ASCII sicuro derivato dalla destinazione. */
export function icsFilenameForDestination(destination: string): string {
  const slug = destination
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // rimuove i diacritici (é → e)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `easytrip-${slug || "viaggio"}.ics`;
}
