import { container } from "@/server/di/container";
import { BillingController } from "@/server/controllers/BillingController";

const billingController = new BillingController(container.services.billingService);

/** Il body deve restare raw (stringa) per verificare la firma Stripe — niente cache. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  return billingController.handleStripeWebhook(req);
}

