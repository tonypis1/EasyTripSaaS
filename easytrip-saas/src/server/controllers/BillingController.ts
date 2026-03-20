import { BaseController } from "@/server/controllers/BaseController";
import { BillingService } from "@/server/services/billing/billingService";
import { createCheckoutSchema } from "@/server/validators/billing.schema";
import { AppError } from "@/server/errors/AppError";

export class BillingController extends BaseController {
  constructor(private readonly billingService: BillingService) {
    super();
  }

  async createCheckout(req: Request) {
    try {
      const body = await req.json();
      const input = createCheckoutSchema.parse(body);
      const session = await this.billingService.createCheckoutSession(input);
      return this.ok(session, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "BillingController.createCheckout"
        );
      }
      return this.fail(error, "BillingController.createCheckout");
    }
  }

  async handleStripeWebhook(req: Request) {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get("stripe-signature");
      const result = await this.billingService.handleStripeWebhook(
        rawBody,
        signature
      );
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "BillingController.handleStripeWebhook");
    }
  }
}

