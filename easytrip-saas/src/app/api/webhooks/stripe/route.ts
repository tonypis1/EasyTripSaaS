import { container } from "@/server/di/container";
import { BillingController } from "@/server/controllers/BillingController";

const billingController = new BillingController(container.services.billingService);

export async function POST(req: Request) {
  return billingController.handleStripeWebhook(req);
}

