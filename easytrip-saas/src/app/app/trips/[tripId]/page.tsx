import { TripDetailClient } from "./trip-detail-client";
import { fetchTripDetailForDashboard } from "@/lib/trips-data";

type Search = { checkout?: string; regen?: string; reactivate?: string };

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<Search>;
}) {
  const { tripId } = await params;
  const sp = (await searchParams) ?? {};
  const trip = await fetchTripDetailForDashboard(tripId);

  let checkoutFlash: "success" | "cancel" | null = null;
  if (sp.checkout === "success") checkoutFlash = "success";
  if (sp.checkout === "cancel") checkoutFlash = "cancel";

  let regenFlash: "success" | "cancel" | null = null;
  if (sp.regen === "success") regenFlash = "success";
  if (sp.regen === "cancel") regenFlash = "cancel";

  let reactivateFlash: "success" | "cancel" | null = null;
  if (sp.reactivate === "success") reactivateFlash = "success";
  if (sp.reactivate === "cancel") reactivateFlash = "cancel";

  const showDevShortcut = process.env.NODE_ENV === "development";

  return (
    <TripDetailClient
      initialTrip={trip}
      checkoutFlash={checkoutFlash}
      regenFlash={regenFlash}
      reactivateFlash={reactivateFlash}
      showDevShortcut={showDevShortcut}
    />
  );
}
