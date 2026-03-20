import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const generateItinerary = inngest.createFunction(
  {
    id: "generate-itinerary",
    name: "Genera itinerario EasyTrip",
    retries: 3,
    triggers: [{ event: "trip/generate.requested" }],
  },
  async ({ event }) => {
    const { tripId } = event.data;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { versions: true },
    });

    if (!trip) {
      throw new Error(`Trip ${tripId} non trovato`);
    }

    // TODO: chiamare Claude API (Prompt P1) e salvare Day records
    // Per ora: stub che crea TripVersion + Day placeholder
    const versionNum = (trip.regenCount ?? 0) + 1;

    await prisma.tripVersion.updateMany({
      where: { tripId },
      data: { isActive: false },
    });

    const version = await prisma.tripVersion.create({
      data: {
        tripId,
        versionNum,
        isActive: true,
      },
    });

    const numDays = Math.ceil(
      (trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    for (let d = 1; d <= numDays; d++) {
      const unlockDate = new Date(trip.startDate);
      unlockDate.setDate(unlockDate.getDate() + d - 1);

      await prisma.day.create({
        data: {
          tripVersionId: version.id,
          dayNumber: d,
          unlockDate,
          title: `Giorno ${d}`,
          morning: "{}",
          afternoon: "{}",
          evening: "{}",
        },
      });
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: {
        regenCount: versionNum,
        currentVersion: versionNum,
        status: "active",
      },
    });

    return { tripId, versionNum, daysCreated: numDays };
  }
);
