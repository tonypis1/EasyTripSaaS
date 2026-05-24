import { container } from "@/server/di/container";

const billingController = container.controllers.billingController;

/** Il body deve restare raw (stringa) per verificare la firma Stripe — niente cache. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  return billingController.handleStripeWebhook(req);
}
