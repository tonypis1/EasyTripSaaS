import { notFound } from "next/navigation";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";

/** Solo Server Components / Route Handlers: usa Prisma + Clerk lato server */
export async function fetchTripsForDashboard() {
  return container.services.tripService.listMyTrips();
}

export async function fetchTripDetailForDashboard(tripId: string) {
  try {
    return await container.services.tripService.getTripDetail(tripId);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }
}
