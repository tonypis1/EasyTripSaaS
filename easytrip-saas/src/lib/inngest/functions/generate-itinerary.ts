import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import {
  addCalendarDaysUtc,
  inclusiveCalendarDaysBetweenUtc,
} from "@/lib/calendar-date";
import {
  normalizeAiLocale,
  type SupportedAiLocale,
} from "@/lib/ai/prompt-locale";
import { resolveTripGeneratePayload } from "@/lib/inngest/trip-generate-payload";
import { type DaySlot } from "@/lib/itinerary-model-schema";
import { ItineraryGenerationService } from "@/server/services/trip/itineraryGenerationService";
import {
  itineraryReadyHtml,
  itineraryReadyMemberHtml,
  sendTransactionalEmail,
} from "@/lib/email/transactional";
import { normalizeEmailLocale, t as trEmail } from "@/lib/email/email-i18n";
import { formatGeoScoreLabel } from "@/lib/geo-score-ui";
import { config } from "@/config/unifiedConfig";

/** Dati trip serializzabili tra gli step Inngest (JSON). */
type TripSnapshot = {
  id: string;
  destination: string;
  startDateIso: string;
  endDateIso: string;
  tripType: string;
  style: string | null;
  budgetLevel: string;
  regenCount: number;
  usedZones: string | null;
  localPassCityCount: number;
  /** Lingua preferita dell'organizer (passata ai prompt Claude). */
  organizerLanguage: SupportedAiLocale;
};

function fallbackSlot(label: string): DaySlot {
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

export const generateItinerary = inngest.createFunction(
  {
    id: "generate-itinerary",
    name: "Genera itinerario EasyTrip",
    retries: 3,
    triggers: [{ event: "trip/generate.requested" }],
    timeouts: { finish: "15m" },
    /**
     * Belt-and-braces guard against duplicate itinerary versions for the same
     * trip. Even if multiple `trip/generate.requested` events leak through
     * (e.g. webhook re-delivery, frontend bug, manual replay), Inngest will
     * execute them serially per `tripId` instead of in parallel. The original
     * cause is now fixed upstream (URL strip + version guard in billing), so
     * this is purely a safety net; replays/retries for the same event are
     * already handled by Inngest's own retry semantics.
     */
    concurrency: { key: "event.data.tripId", limit: 1 },
  },
  async ({ event, events, step }) => {
    const { tripId } = resolveTripGeneratePayload(event, events);

    const trip = await step.run(
      "carica-trip",
      async (): Promise<TripSnapshot> => {
        const t = await prisma.trip.findUnique({
          where: { id: tripId },
          include: {
            organizer: { select: { language: true } },
          },
        });
        if (!t) {
          throw new Error(`Trip ${tripId} non trovato`);
        }
        return {
          id: t.id,
          destination: t.destination,
          startDateIso: t.startDate.toISOString(),
          endDateIso: t.endDate.toISOString(),
          tripType: t.tripType,
          style: t.style,
          budgetLevel: t.budgetLevel ?? "moderate",
          regenCount: t.regenCount ?? 0,
          usedZones: t.usedZones,
          localPassCityCount:
            (t as { localPassCityCount?: number }).localPassCityCount ?? 0,
          organizerLanguage: normalizeAiLocale(t.organizer?.language),
        };
      },
    );

    const startDate = new Date(trip.startDateIso);
    const endDate = new Date(trip.endDateIso);
    const numDays = inclusiveCalendarDaysBetweenUtc(startDate, endDate);

    const itineraryGenerationService = new ItineraryGenerationService();

    const gen = await step.run("genera-con-claude", () =>
      itineraryGenerationService.generate({
        destination: trip.destination,
        startDate,
        endDate,
        numDays,
        tripType: trip.tripType,
        style: trip.style,
        budgetLevel: trip.budgetLevel,
        usedZones: trip.usedZones,
        localPassCityCount: trip.localPassCityCount,
        locale: trip.organizerLanguage,
      }),
    );

    // -------------------------------------------------------------------
    // Persistenza versione + giorni — split in 4 step Inngest idempotenti.
    //
    // Inngest memorizza l'output di ogni step.run() completato; in caso di
    // retry, gli step già completati NON vengono rieseguiti. Spezzando il
    // vecchio mono-step "salva-versione-e-giorni" in 4 step più piccoli ogni
    // azione effettuata sul DB resta legata al suo step, e l'incremento di
    // `regenCount` non viene mai applicato due volte.
    //
    // L'invariante di sistema (un solo (tripId, versionNum) per coppia) è
    // inoltre tutelata a livello DB dal vincolo @@unique introdotto nella
    // migration `unique_trip_version`. Qui il codice è scritto per essere
    // idempotente anche senza quel vincolo, ma in caso di race con un altro
    // job concorrente cattura `P2002` come safety net.
    // -------------------------------------------------------------------

    /**
     * Step 1 — riserva atomicamente il prossimo versionNum incrementando
     * `trip.regenCount` con un UPDATE atomico SQL. Eseguito una sola volta
     * grazie alla memoizzazione di Inngest.
     */
    const versionNum = await step.run("riserva-version-num", async () => {
      const updated = await prisma.trip.update({
        where: { id: trip.id },
        data: { regenCount: { increment: 1 } },
        select: { regenCount: true },
      });
      return updated.regenCount;
    });

    /**
     * Step 2 — prepara la riga TripVersion (find-or-create) per la coppia
     * (tripId, versionNum). Idempotente: al retry trova la riga esistente.
     * In caso di race con un job concorrente (improbabile ma possibile),
     * P2002 indica che un'altra esecuzione ha già creato la riga: la
     * leggiamo e proseguiamo.
     */
    const versionId = await step.run("prepara-version-row", async () => {
      // Disattiva tutte le altre versioni del trip (idempotente).
      await prisma.tripVersion.updateMany({
        where: { tripId: trip.id, versionNum: { not: versionNum } },
        data: { isActive: false },
      });

      const existing = await prisma.tripVersion.findFirst({
        where: { tripId: trip.id, versionNum },
        select: { id: true },
      });

      if (existing) {
        await prisma.tripVersion.update({
          where: { id: existing.id },
          data: { isActive: true, geoScore: gen.optimizationScore },
        });
        return existing.id;
      }

      try {
        const created = await prisma.tripVersion.create({
          data: {
            tripId: trip.id,
            versionNum,
            isActive: true,
            geoScore: gen.optimizationScore,
          },
          select: { id: true },
        });
        return created.id;
      } catch (err) {
        // P2002 = unique constraint violation. Race con concorrente.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          const found = await prisma.tripVersion.findFirstOrThrow({
            where: { tripId: trip.id, versionNum },
            select: { id: true },
          });
          await prisma.tripVersion.update({
            where: { id: found.id },
            data: { isActive: true, geoScore: gen.optimizationScore },
          });
          return found.id;
        }
        throw err;
      }
    });

    /**
     * Step 3 — popola i giorni della TripVersion. Idempotente: pulisce
     * eventuali Day creati da un tentativo precedente fallito a metà,
     * poi ricrea l'intero set di Day dal piano corrente.
     */
    const zoneParts = await step.run("crea-days", async () => {
      await prisma.day.deleteMany({ where: { tripVersionId: versionId } });

      const zones: string[] = [];
      for (const day of gen.days) {
        const unlockDate = addCalendarDaysUtc(startDate, day.dayNumber - 1);
        if (day.zoneFocus?.trim()) zones.push(day.zoneFocus.trim());

        await prisma.day.create({
          data: {
            tripVersionId: versionId,
            dayNumber: day.dayNumber,
            unlockDate,
            title: day.title || `Giorno ${day.dayNumber}`,
            morning: JSON.stringify(
              day.morning ?? fallbackSlot("Mattina libera"),
            ),
            afternoon: JSON.stringify(
              day.afternoon ?? fallbackSlot("Pomeriggio libero"),
            ),
            evening: JSON.stringify(
              day.evening ?? fallbackSlot("Serata libera"),
            ),
            restaurants:
              day.restaurants && day.restaurants.length > 0
                ? JSON.stringify(day.restaurants)
                : null,
            mapCenterLat: day.mapCenterLat != null ? day.mapCenterLat : null,
            mapCenterLng: day.mapCenterLng != null ? day.mapCenterLng : null,
            zoneFocus: day.zoneFocus || null,
            dowWarning: day.dowWarning || null,
            localGem: day.localGem || null,
            tips: day.tips || null,
          },
        });
      }
      return zones;
    });

    /**
     * Step 4 — aggiorna i campi puntatori sul Trip (currentVersion, status,
     * usedZones). `regenCount` è già stato incrementato nello Step 1.
     */
    const result = await step.run("aggiorna-trip", async () => {
      const usedZonesMerged = Array.from(new Set(zoneParts)).join(" | ");
      const usedZonesCombined = [trip.usedZones, usedZonesMerged]
        .filter((s) => s != null && String(s).trim().length > 0)
        .join(" | ");

      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          currentVersion: versionNum,
          status: "active",
          usedZones: usedZonesCombined.length > 0 ? usedZonesCombined : null,
        },
      });

      return {
        versionNum,
        daysCreated: numDays,
        optimizationScore: gen.optimizationScore,
      };
    });

    await step.run("email-itinerario-pronto", async () => {
      const full = await prisma.trip.findUnique({
        where: { id: trip.id },
        include: {
          organizer: { select: { email: true, language: true } },
          members: {
            where: { role: "member" },
            include: {
              user: { select: { email: true, language: true } },
            },
          },
        },
      });
      if (!full?.organizer?.email) return;

      const tripUrl = `${config.app.baseUrl}/app/trips/${trip.id}`;
      const label = formatGeoScoreLabel(result.optimizationScore);
      const organizerLocale = normalizeEmailLocale(full.organizer.language);

      await sendTransactionalEmail({
        to: full.organizer.email,
        subject: `${trEmail("subject.itineraryReady", organizerLocale)} — ${full.destination}`,
        html: itineraryReadyHtml({
          destination: full.destination,
          tripUrl,
          geoScoreLabel: label,
          locale: organizerLocale,
        }),
      });

      for (const m of full.members) {
        const em = m.user.email?.trim();
        if (!em || em === full.organizer.email) continue;
        const memberLocale = normalizeEmailLocale(m.user.language);
        try {
          await sendTransactionalEmail({
            to: em,
            subject: `${trEmail("subject.itineraryReady", memberLocale)} — ${full.destination}`,
            html: itineraryReadyMemberHtml({
              destination: full.destination,
              tripUrl,
              geoScoreLabel: label,
              locale: memberLocale,
            }),
          });
        } catch {
          /* best-effort */
        }
      }
    });

    return { tripId: trip.id, ...result };
  },
);
