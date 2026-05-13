import { redirect } from "next/navigation";
import { TripDetailClient } from "./trip-detail-client";
import { fetchTripDetailForDashboard } from "@/lib/trips-data";
import { container } from "@/server/di/container";
import { logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

type Search = {
  checkout?: string;
  session_id?: string;
  regen?: string;
  reactivate?: string;
};

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string; locale: string }>;
  searchParams?: Promise<Search>;
}) {
  const { tripId, locale } = await params;
  const sp = (await searchParams) ?? {};

  const sid = sp.session_id;
  const needsSync =
    typeof sid === "string" &&
    sid.startsWith("cs_") &&
    (sp.checkout === "success" ||
      sp.regen === "success" ||
      sp.reactivate === "success");

  if (needsSync) {
    try {
      await container.services.billingService.syncCheckoutSessionAfterRedirect({
        tripId,
        sessionId: sid,
      });
    } catch (e) {
      logger.error(
        "syncCheckoutSessionAfterRedirect failed (webhook may still apply)",
        e,
        { tripId, sessionId: sid },
      );
    }

    // Strip `session_id` from the URL so that the client-side `router.refresh()`
    // running every ~5s while the trip is `pending` doesn't keep re-evaluating
    // `needsSync = true` and re-firing `trip/generate.requested` Inngest events
    // (root cause of the "multiple itinerary versions auto-generated" bug).
    // Flash params (`checkout` / `regen` / `reactivate`) are kept so the toast
    // still shows once on the first render after the redirect.
    const cleanQuery = new URLSearchParams();
    if (sp.checkout) cleanQuery.set("checkout", sp.checkout);
    if (sp.regen) cleanQuery.set("regen", sp.regen);
    if (sp.reactivate) cleanQuery.set("reactivate", sp.reactivate);
    const qs = cleanQuery.toString();
    redirect(`/${locale}/app/trips/${tripId}${qs ? `?${qs}` : ""}`);
  } else if (
    sp.checkout === "success" ||
    sp.regen === "success" ||
    sp.reactivate === "success"
  ) {
    logger.info(
      "Checkout success URL senza session_id: aggiorna APP_BASE_URL e rideploy, oppure correggi il webhook Stripe",
      {
        tripId,
        checkout: sp.checkout,
        regen: sp.regen,
        reactivate: sp.reactivate,
      },
    );
  }

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
