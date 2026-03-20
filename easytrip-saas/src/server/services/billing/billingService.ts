import Stripe from "stripe";
import { inngest } from "@/lib/inngest/client";
import { stripe } from "@/lib/billing/stripe";
import { config } from "@/config/unifiedConfig";
import { AppError } from "@/server/errors/AppError";
import { AuthService } from "@/server/services/auth/authService";
import { TripRepository } from "@/server/repositories/TripRepository";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";

type CheckoutInput = {
  tripId: string;
  successUrl?: string;
  cancelUrl?: string;
};

export class BillingService {
  constructor(
    private readonly authService: AuthService,
    private readonly tripRepository: TripRepository,
    private readonly paymentRepository: PaymentRepository
  ) {}

  async createCheckoutSession(input: CheckoutInput) {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findByIdAndOrganizer(input.tripId, user.id);

    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }

    const amount =
      trip.tripType === "gruppo"
        ? config.billing.priceGroupCents
        : config.billing.priceSoloCoupleCents;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        input.successUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?checkout=success`,
      cancel_url:
        input.cancelUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?checkout=cancel`,
      customer_email: user.email,
      metadata: {
        tripId: trip.id,
        appUserId: user.id,
        paymentType: "purchase",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.billing.currency,
            unit_amount: amount,
            product_data: {
              name:
                trip.tripType === "gruppo"
                  ? "EasyTrip — Viaggio Gruppo"
                  : "EasyTrip — Viaggio Solo/Coppia",
              description: `${trip.destination} (${trip.startDate.toISOString().slice(0, 10)} - ${trip.endDate.toISOString().slice(0, 10)})`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new AppError(
        "Checkout URL non disponibile",
        500,
        "CHECKOUT_URL_MISSING"
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountCents: amount,
    };
  }

  async handleStripeWebhook(rawBody: string, signature: string | null) {
    if (!signature) {
      throw new AppError(
        "Firma webhook Stripe mancante",
        400,
        "MISSING_SIGNATURE"
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.billing.stripeWebhookSecret
      );
    } catch {
      throw new AppError("Firma webhook Stripe non valida", 400, "INVALID_SIGNATURE");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tripId = session.metadata?.tripId;
      const appUserId = session.metadata?.appUserId;
      const stripePaymentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.id;

      if (!tripId || !appUserId) {
        throw new AppError(
          "Metadata Stripe incompleto",
          400,
          "INVALID_METADATA"
        );
      }

      const amount = (session.amount_total ?? 0) / 100;
      await this.paymentRepository.create({
        userId: appUserId,
        tripId,
        type: "purchase",
        stripePaymentId,
        amount,
      });

      await this.tripRepository.markAsPaid(tripId, {
        paymentId: stripePaymentId,
        amountPaid: amount,
      });

      await inngest.send({
        name: "trip/generate.requested",
        data: { tripId, userId: appUserId },
      });
    }

    return { received: true };
  }
}

