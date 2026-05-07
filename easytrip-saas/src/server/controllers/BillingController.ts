import { BaseController } from "@/server/controllers/BaseController";
import { BillingService } from "@/server/services/billing/billingService";
import {
  createCheckoutSchema,
  createRegenCheckoutSchema,
  createReactivateCheckoutSchema,
  createSubscriptionCheckoutSchema,
} from "@/server/validators/billing.schema";
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
          "BillingController.createCheckout",
        );
      }
      return this.fail(error, "BillingController.createCheckout");
    }
  }

  async createRegenCheckout(req: Request) {
    try {
      const body = await req.json();
      const input = createRegenCheckoutSchema.parse(body);
      const session =
        await this.billingService.createRegenCheckoutSession(input);
      return this.ok(session, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "BillingController.createRegenCheckout",
        );
      }
      return this.fail(error, "BillingController.createRegenCheckout");
    }
  }

  async createReactivateCheckout(req: Request) {
    try {
      const body = await req.json();
      const input = createReactivateCheckoutSchema.parse(body);
      const session =
        await this.billingService.createReactivateCheckoutSession(input);
      return this.ok(session, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "BillingController.createReactivateCheckout",
        );
      }
      return this.fail(error, "BillingController.createReactivateCheckout");
    }
  }

  /**
   * POST /api/billing/subscribe
   * Crea una Stripe Checkout Session in modalità `subscription` per il piano
   * "Viaggiatore Frequente" (€6,99/mese). Il body è opzionale: senza param
   * l'utente verrà rimandato a `/app?subscribe=success|cancel`.
   */
  async createSubscriptionCheckout(req: Request) {
    try {
      const text = await req.text();
      const parsedBody = text.trim().length > 0 ? JSON.parse(text) : {};
      const input = createSubscriptionCheckoutSchema.parse(parsedBody);
      const session =
        await this.billingService.createSubscriptionCheckoutSession(input);
      return this.ok(session, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "BillingController.createSubscriptionCheckout",
        );
      }
      return this.fail(error, "BillingController.createSubscriptionCheckout");
    }
  }

  async handleStripeWebhook(req: Request) {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get("stripe-signature");
      const result = await this.billingService.handleStripeWebhook(
        rawBody,
        signature,
      );
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "BillingController.handleStripeWebhook");
    }
  }
}
