import { container } from "@/server/di/container";

const billingController = container.controllers.billingController;

export async function POST(req: Request) {
  return billingController.createSubscriptionCheckout(req);
}
