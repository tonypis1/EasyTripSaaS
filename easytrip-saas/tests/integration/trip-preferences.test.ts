import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { TripRepository } from "@/server/repositories/TripRepository";
import { createTripSchema } from "@/server/validators/trip.schema";
import { preferencesFromTrip } from "@/lib/trip/preferences";

const run = !!process.env.DATABASE_URL;

describe.skipIf(!run)(
  "Preferenze strutturate del viaggio (integration)",
  () => {
    const repo = new TripRepository();
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let organizerId: string;
    let otherUserId: string;
    const tripIds: string[] = [];

    const base = {
      destination: "Roma",
      startDate: new Date(Date.UTC(2026, 5, 1)),
      endDate: new Date(Date.UTC(2026, 5, 3)),
      tripType: "solo" as const,
      budgetLevel: "moderate" as const,
      localPassCityCount: 0,
    };

    /** Crea un viaggio passando per il validatore reale: i campi omessi prendono i default dello schema. */
    function createTrip(overrides: Record<string, unknown>) {
      const parsed = createTripSchema.parse({
        destination: "Roma",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        tripType: "solo",
        ...overrides,
      });
      return repo.create({ ...parsed, organizerId });
    }

    async function reload(id: string) {
      return prisma.trip.findUniqueOrThrow({ where: { id } });
    }

    beforeAll(async () => {
      const [a, b] = await Promise.all(
        ["a", "b"].map((n) =>
          prisma.user.create({
            data: {
              clerkUserId: `int_pref_${n}_${suffix}`,
              email: `int_pref_${n}_${suffix}@example.com`,
            },
          }),
        ),
      );
      organizerId = a.id;
      otherUserId = b.id;
    });

    afterAll(async () => {
      await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
      await prisma.user.deleteMany({
        where: { id: { in: [organizerId, otherUserId] } },
      });
      await prisma.$disconnect();
    });

    it("un viaggio creato senza preferenze ha elenchi vuoti e ritmo NULL (default del DB)", async () => {
      const parsed = createTripSchema.parse({
        destination: "Lisbona",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        tripType: "solo",
      });
      const trip = await repo.create({ ...parsed, organizerId });
      tripIds.push(trip.id);

      const row = await reload(trip.id);
      expect(row.interests).toEqual([]);
      expect(row.mobilityNeeds).toEqual([]);
      expect(row.dietaryRestrictions).toEqual([]);
      expect(row.pace).toBeNull();
    });

    it("salva e rilegge le preferenze scelte alla creazione (payload validato, normalizzato)", async () => {
      const parsed = createTripSchema.parse({
        destination: "Roma",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        tripType: "coppia",
        interests: ["wellness", "art_museums", "wellness"],
        pace: "relaxed",
        mobilityNeeds: ["wheelchair"],
        dietaryRestrictions: ["gluten_free", "vegetarian", "nut_allergy"],
      });
      const trip = await repo.create({ ...parsed, organizerId });
      tripIds.push(trip.id);

      const row = await reload(trip.id);
      expect(row.interests).toEqual(["art_museums", "wellness"]);
      expect(row.pace).toBe("relaxed");
      expect(row.mobilityNeeds).toEqual(["wheelchair"]);
      expect(row.dietaryRestrictions).toEqual([
        "vegetarian",
        "gluten_free",
        "nut_allergy",
      ]);
      expect(preferencesFromTrip(row)).toEqual({
        interests: ["art_museums", "wellness"],
        pace: "relaxed",
        mobilityNeeds: ["wheelchair"],
        dietaryRestrictions: ["vegetarian", "gluten_free", "nut_allergy"],
      });
    });

    describe("aggiornamento", () => {
      let id: string;

      beforeAll(async () => {
        const trip = await repo.create({
          ...base,
          organizerId,
          interests: ["history", "nature"],
          pace: "packed",
          mobilityNeeds: ["stroller"],
          dietaryRestrictions: ["vegan"],
        });
        id = trip.id;
        tripIds.push(id);
      });

      it("i campi omessi restano invariati; quelli forniti cambiano; il flag di modifica si attiva", async () => {
        const res = await repo.updatePreferences(id, organizerId, {
          budgetLevel: "premium",
          interests: ["food_wine"],
        });

        expect(res.updated).toBe(true);
        const row = await reload(id);
        expect(row.interests).toEqual(["food_wine"]);
        expect(row.budgetLevel).toBe("premium");
        expect(row.pace).toBe("packed");
        expect(row.mobilityNeeds).toEqual(["stroller"]);
        expect(row.dietaryRestrictions).toEqual(["vegan"]);
        expect(row.prefChangedAfterGen).toBe(true);
      });

      it("elenco vuoto e ritmo null azzerano esplicitamente", async () => {
        await repo.updatePreferences(id, organizerId, {
          budgetLevel: "premium",
          interests: [],
          pace: null,
          dietaryRestrictions: [],
        });

        const row = await reload(id);
        expect(row.interests).toEqual([]);
        expect(row.pace).toBeNull();
        expect(row.dietaryRestrictions).toEqual([]);
        expect(row.mobilityNeeds).toEqual(["stroller"]); // omesso: invariato
      });

      it("solo l'organizzatore può modificarle", async () => {
        const res = await repo.updatePreferences(id, otherUserId, {
          budgetLevel: "economy",
          dietaryRestrictions: ["halal"],
        });

        expect(res.updated).toBe(false);
        expect((await reload(id)).dietaryRestrictions).toEqual([]);
      });
    });

    it("gli elenchi sono interrogabili (filtri array di Prisma)", async () => {
      const trip = await createTrip({
        dietaryRestrictions: ["kosher"],
        interests: ["adventure"],
      });
      tripIds.push(trip.id);

      const kosher = await prisma.trip.findMany({
        where: { id: trip.id, dietaryRestrictions: { has: "kosher" } },
      });
      const notHalal = await prisma.trip.findMany({
        where: { id: trip.id, dietaryRestrictions: { has: "halal" } },
      });
      expect(kosher).toHaveLength(1);
      expect(notHalal).toHaveLength(0);
    });

    it("le preferenze escono nell'export dei dati dell'utente (portabilità GDPR): fanno parte della riga Trip", async () => {
      const trip = await createTrip({ dietaryRestrictions: ["vegetarian"] });
      tripIds.push(trip.id);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: organizerId },
        include: { tripsAsOrganizer: { where: { id: trip.id } } },
      });

      // L'export spalma la riga del Trip (`...t`): le nuove colonne ci sono senza altro codice.
      expect(user.tripsAsOrganizer[0]).toMatchObject({
        dietaryRestrictions: ["vegetarian"],
        interests: [],
        pace: null,
      });
    });

    it("eliminando il viaggio spariscono anche le preferenze (nessuna tabella a parte)", async () => {
      const trip = await createTrip({ dietaryRestrictions: ["halal"] });

      await prisma.trip.delete({ where: { id: trip.id } });

      expect(await prisma.trip.count({ where: { id: trip.id } })).toBe(0);
    });
  },
);
