import Stripe from "stripe";
import { inngest } from "@/lib/inngest/client";
import { stripe } from "@/lib/billing/stripe";
import { config } from "@/config/unifiedConfig";
import { AppError } from "@/server/errors/AppError";
import { AuthService } from "@/server/services/auth/authService";
import { TripRepository } from "@/server/repositories/TripRepository";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import { toDateOnlyIsoUtc } from "@/lib/calendar-date";
import { logger } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import {
  abandonedCheckoutHtml,
  purchaseConfirmedHtml,
  sendTransactionalEmail,
} from "@/lib/email/transactional";
import {
  normalizeEmailLocale,
  t as trEmail,
} from "@/lib/email/email-i18n";
import { tryClaimWebhookDelivery } from "@/lib/email/webhookDelivery";
import { isPaidRegeneration } from "@/lib/trip-regen-rules";
function purchaseAmountCentsForTrip(trip: {
  tripType: string;
  localPassCityCount?: number | null;
}): number {
  const base =
    trip.tripType === "gruppo"
      ? config.billing.priceGroupCents
      : config.billing.priceSoloCoupleCents;
  const n = Math.min(30, Math.max(0, trip.localPassCityCount ?? 0));
  return base + n * config.billing.priceLocalPassCents;
}

function purchaseProductCopy(trip: {
  tripType: string;
  localPassCityCount?: number | null;
  destination: string;
  startDate: Date;
  endDate: Date;
}): { productName: string; description: string } {
  const lpCount = Math.min(30, Math.max(0, trip.localPassCityCount ?? 0));
  const baseName =
    trip.tripType === "gruppo"
      ? "EasyTrip — Viaggio Gruppo"
      : "EasyTrip — Viaggio Solo/Coppia";
  const productName =
    lpCount > 0
      ? `${baseName} + LocalPass (${lpCount} città)`
      : baseName;
  const dates = `${toDateOnlyIsoUtc(trip.startDate)} - ${toDateOnlyIsoUtc(trip.endDate)}`;
  const lpExtra =
    lpCount > 0
      ? ` — LocalPass: ${lpCount} città (€${((lpCount * config.billing.priceLocalPassCents) / 100).toFixed(2)})`
      : "";
  const description = `${trip.destination} (${dates})${lpExtra}`;
  return { productName, description };
}


type CheckoutInput = {
  tripId: string;
  successUrl?: string;
  cancelUrl?: string;
};

type RegenCheckoutInput = {
  tripId: string;
  successUrl?: string;
  cancelUrl?: string;
};

type ReactivateCheckoutInput = {
  tripId: string;
  successUrl?: string;
  cancelUrl?: string;
};

export class BillingService {
  constructor(
    private readonly authService: AuthService,
    private readonly tripRepository: TripRepository,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  /**
   * Trova i crediti non usati e non scaduti dell'utente,
   * ordinati per scadenza più vicina (FIFO — usa quelli che scadono prima).
   */
  private async getAvailableCredits(userId: string) {
    return prisma.credit.findMany({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "asc" },
    });
  }

  /**
   * Consuma crediti in una transazione atomica (FIFO per scadenza).
   * Restituisce il totale in centesimi effettivamente applicato.
   */
  private async applyCredits(
    userId: string,
    tripId: string,
    maxCents: number,
  ): Promise<number> {
    const credits = await this.getAvailableCredits(userId);
    if (credits.length === 0) return 0;

    let remaining = maxCents;
    let totalApplied = 0;

    await prisma.$transaction(async (tx) => {
      for (const credit of credits) {
        if (remaining <= 0) break;
        const creditCents = Math.round(Number(credit.amount) * 100);
        const apply = Math.min(creditCents, remaining);

        await tx.credit.update({
          where: { id: credit.id },
          data: { used: true, usedOnTripId: tripId },
        });

        totalApplied += apply;
        remaining -= apply;
      }

      if (totalApplied > 0) {
        const appliedEuros = totalApplied / 100;
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { decrement: appliedEuros } },
        });
      }
    });

    return totalApplied;
  }

  async createCheckoutSession(input: CheckoutInput) {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findByIdAndOrganizer(
      input.tripId,
      user.id,
    );

    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }

    const fullAmountCents = purchaseAmountCentsForTrip(trip);

    const availableCredits = await this.getAvailableCredits(user.id);
    const totalCreditCents = availableCredits.reduce(
      (sum, c) => sum + Math.round(Number(c.amount) * 100),
      0,
    );
    const creditToApplyCents = Math.min(totalCreditCents, fullAmountCents);
    const stripeAmountCents = fullAmountCents - creditToApplyCents;

    const { productName, description } = purchaseProductCopy(trip);

    /* ── SCENARIO A: crediti coprono TUTTO ── */
    if (stripeAmountCents <= 0) {
      const applied = await this.applyCredits(
        user.id,
        trip.id,
        fullAmountCents,
      );

      const creditPaymentId = `credit_full_${trip.id}_${Date.now()}`;
      await this.paymentRepository.create({
        userId: user.id,
        tripId: trip.id,
        type: "purchase",
        stripePaymentId: creditPaymentId,
        amount: 0,
      });

      await this.tripRepository.markAsPaid(trip.id, {
        paymentId: creditPaymentId,
        amountPaid: 0,
      });

      try {
        const tripUrl = `${config.app.baseUrl}/app/trips/${trip.id}`;
        const userLocale = normalizeEmailLocale(user.language);
        await sendTransactionalEmail({
          to: user.email,
          subject: trEmail("subject.purchaseConfirmed", userLocale, {
            destination: trip.destination,
          }),
          html: purchaseConfirmedHtml({
            destination: trip.destination,
            tripUrl,
            locale: userLocale,
          }),
        });
      } catch {
        /* email failure does not block */
      }

      await inngest.send({
        name: "trip/generate.requested",
        data: { tripId: trip.id },
      });

      logger.info("Acquisto completato con crediti (nessun Stripe)", {
        tripId: trip.id,
        creditAppliedCents: applied,
      });

      return {
        fullyPaidByCredit: true as const,
        creditAppliedCents: applied,
        originalAmountCents: fullAmountCents,
        amountCents: 0,
      };
    }

    /* ── SCENARIO B/C: Stripe (con eventuale sconto crediti) ── */
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
        ...(creditToApplyCents > 0
          ? { creditApplyCents: String(creditToApplyCents) }
          : {}),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.billing.currency,
            unit_amount: stripeAmountCents,
            product_data: {
              name: productName,
              description:
                creditToApplyCents > 0
                  ? `${description} — sconto crediti €${(creditToApplyCents / 100).toFixed(2)}`
                  : description,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new AppError(
        "Checkout URL non disponibile",
        500,
        "CHECKOUT_URL_MISSING",
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountCents: stripeAmountCents,
      creditAppliedCents: creditToApplyCents,
      originalAmountCents: fullAmountCents,
    };
  }

  /**
   * Checkout €1,99 per rigenerazioni versione 5–7 (dopo le 3 gratuite).
   */
  async createRegenCheckoutSession(input: RegenCheckoutInput) {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findByIdAndOrganizer(
      input.tripId,
      user.id,
    );

    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }

    if (trip.amountPaid == null) {
      throw new AppError(
        "Acquista prima il viaggio principale",
        400,
        "TRIP_NOT_PAID",
      );
    }

    if (!isPaidRegeneration(trip.regenCount)) {
      throw new AppError(
        "Questa rigenerazione è gratuita: usa il pulsante «Rigenera» senza pagamento.",
        400,
        "REGEN_NOT_PAID_TIER",
      );
    }

    const amount = config.billing.priceRegenCents;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        input.successUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?regen=success`,
      cancel_url:
        input.cancelUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?regen=cancel`,
      customer_email: user.email,
      metadata: {
        tripId: trip.id,
        appUserId: user.id,
        paymentType: "regen",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.billing.currency,
            unit_amount: amount,
            product_data: {
              name: "EasyTrip — Rigenerazione itinerario",
              description: `Rigenerazione a pagamento — ${trip.destination}`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new AppError(
        "Checkout URL non disponibile",
        500,
        "CHECKOUT_URL_MISSING",
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountCents: amount,
    };
  }

  /**
   * Checkout €2,90 per riattivare l'accesso post-trip (estende di 30 giorni).
   */
  async createReactivateCheckoutSession(input: ReactivateCheckoutInput) {
    const user = await this.authService.getOrCreateCurrentUser();
    const trip = await this.tripRepository.findByIdAndOrganizer(
      input.tripId,
      user.id,
    );

    if (!trip) {
      throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
    }

    if (trip.accessExpiresAt > new Date()) {
      throw new AppError(
        "L'accesso è ancora attivo, non serve la riattivazione.",
        400,
        "ACCESS_STILL_ACTIVE",
      );
    }

    const amount = config.billing.priceReactivateCents;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        input.successUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?reactivate=success`,
      cancel_url:
        input.cancelUrl ??
        `${config.app.baseUrl}/app/trips/${trip.id}?reactivate=cancel`,
      customer_email: user.email,
      metadata: {
        tripId: trip.id,
        appUserId: user.id,
        paymentType: "reactivate",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.billing.currency,
            unit_amount: amount,
            product_data: {
              name: "EasyTrip — Riattivazione accesso",
              description: `Rileggi i ricordi di ${trip.destination} (30 giorni extra)`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new AppError(
        "Checkout URL non disponibile",
        500,
        "CHECKOUT_URL_MISSING",
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountCents: amount,
    };
  }

  /**
   * Aggiorna piano abbonamento da eventi Stripe Subscription (webhook).
   */
  private async syncSubscriptionPlanFromStripe(sub: Stripe.Subscription) {
    const priceFilter = config.billing.stripeSubscriptionPriceId;
    if (priceFilter) {
      const matches = sub.items.data.some(
        (item) => item.price.id === priceFilter,
      );
      if (!matches) {
        logger.info("Webhook subscription: price non corrispondente, skip", {
          subscriptionId: sub.id,
          priceFilter,
        });
        return;
      }
    }

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !("email" in customer) || !customer.email) {
      logger.warn("Webhook subscription: customer senza email utilizzabile", {
        customerId,
      });
      return;
    }

    const email = customer.email.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      logger.warn("Webhook subscription: utente non trovato", {
        customerId,
        email,
      });
      return;
    }

    const activeStatuses: Stripe.Subscription.Status[] = ["active", "trialing"];
    const isActive = activeStatuses.includes(sub.status);

    const subExpiresAt = isActive
      ? new Date(sub.current_period_end * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        planType: isActive ? "sub" : "free",
        subExpiresAt,
      },
    });

    logger.info("Subscription sync applicata", {
      userId: user.id,
      subscriptionId: sub.id,
      status: sub.status,
      planType: isActive ? "sub" : "free",
    });
  }

  async handleStripeWebhook(rawBody: string, signature: string | null) {
    if (!signature) {
      throw new AppError(
        "Firma webhook Stripe mancante",
        400,
        "MISSING_SIGNATURE",
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.billing.stripeWebhookSecret,
      );
    } catch {
      throw new AppError(
        "Firma webhook Stripe non valida",
        400,
        "INVALID_SIGNATURE",
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tripId = session.metadata?.tripId;
      const appUserId = session.metadata?.appUserId;
      const paymentType = session.metadata?.paymentType ?? "purchase";

      const stripePaymentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.id;

      if (!tripId || !appUserId) {
        throw new AppError(
          "Metadata Stripe incompleto",
          400,
          "INVALID_METADATA",
        );
      }

      const existingPayment =
        await this.paymentRepository.findByStripePaymentId(stripePaymentId);
      if (existingPayment) {
        logger.info("Webhook Stripe idempotente (pagamento già registrato)", {
          tripId,
          stripeEventId: event.id,
        });
        return { received: true, skipped: "duplicate_payment" as const };
      }

      const trip = await this.tripRepository.findById(tripId);
      if (!trip) {
        throw new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND");
      }

      if (paymentType === "regen") {
        if (trip.amountPaid == null) {
          throw new AppError("Trip non acquistato", 400, "TRIP_NOT_PAID");
        }

        const amount = (session.amount_total ?? 0) / 100;
        await this.paymentRepository.create({
          userId: appUserId,
          tripId,
          type: "regen",
          stripePaymentId,
          amount,
        });

        await inngest.send({
          name: "trip/generate.requested",
          data: { tripId },
        });

        return { received: true };
      }

      if (paymentType === "reactivate") {
        const amount = (session.amount_total ?? 0) / 100;
        await this.paymentRepository.create({
          userId: appUserId,
          tripId,
          type: "reactivate",
          stripePaymentId,
          amount,
        });

        await this.tripRepository.extendAccess(tripId, 30);

        logger.info("Accesso riattivato (+30 giorni)", { tripId });
        return { received: true };
      }

      /**
       * Acquisto iniziale viaggio
       */
      if (trip.paymentId != null && trip.amountPaid != null) {
        logger.info("Webhook acquisto già elaborato (idempotente)", {
          tripId,
          stripeEventId: event.id,
        });
        return { received: true, skipped: "already_paid" as const };
      }

      /* ── Applica crediti parziali se presenti nei metadata ── */
      const creditApplyCents = parseInt(
        session.metadata?.creditApplyCents ?? "0",
        10,
      );
      if (creditApplyCents > 0) {
        const applied = await this.applyCredits(
          appUserId,
          tripId,
          creditApplyCents,
        );
        logger.info("Crediti applicati al checkout (parziale)", {
          tripId,
          requestedCents: creditApplyCents,
          appliedCents: applied,
        });
      }

      const stripeAmount = (session.amount_total ?? 0) / 100;
      await this.paymentRepository.create({
        userId: appUserId,
        tripId,
        type: "purchase",
        stripePaymentId,
        amount: stripeAmount,
      });

      await this.tripRepository.markAsPaid(tripId, {
        paymentId: stripePaymentId,
        amountPaid: stripeAmount,
      });

      const organizer = await prisma.user.findUnique({
        where: { id: appUserId },
        select: { email: true, language: true },
      });
      if (organizer?.email) {
        const tripUrl = `${config.app.baseUrl}/app/trips/${tripId}`;
        const organizerLocale = normalizeEmailLocale(organizer.language);
        await sendTransactionalEmail({
          to: organizer.email,
          subject: trEmail("subject.purchaseConfirmed", organizerLocale, {
            destination: trip.destination,
          }),
          html: purchaseConfirmedHtml({
            destination: trip.destination,
            tripUrl,
            locale: organizerLocale,
          }),
        });
      }

      await inngest.send({
        name: "trip/generate.requested",
        data: { tripId },
      });

      try {
        const { container } = await import("@/server/di/container");
        await container.services.referralService.tryGrantReward(appUserId);
      } catch {
        logger.warn("Referral reward check failed (non-blocking)", {
          appUserId,
        });
      }
    } else if (event.type === "checkout.session.expired") {
      const firstTime = await tryClaimWebhookDelivery("stripe", event.id);
      if (!firstTime) {
        return { received: true, skipped: "duplicate_webhook" as const };
      }

      const session = event.data.object as Stripe.Checkout.Session;
      const tripId = session.metadata?.tripId;
      const paymentType = session.metadata?.paymentType ?? "purchase";

      if (paymentType !== "purchase" || !tripId) {
        return { received: true };
      }

      const trip = await this.tripRepository.findById(tripId);
      if (
        !trip ||
        trip.status !== "pending" ||
        trip.amountPaid != null ||
        trip.deletedAt != null
      ) {
        return { received: true, skipped: "not_abandoned" as const };
      }

      const organizer = await prisma.user.findUnique({
        where: { id: trip.organizerId },
        select: { email: true, language: true },
      });
      if (organizer?.email) {
        const tripUrl = `${config.app.baseUrl}/app/trips/${tripId}`;
        const organizerLocale = normalizeEmailLocale(organizer.language);
        try {
          await sendTransactionalEmail({
            to: organizer.email,
            subject: trEmail("subject.abandonedCheckout", organizerLocale, {
              destination: trip.destination,
            }),
            html: abandonedCheckoutHtml({
              destination: trip.destination,
              tripUrl,
              locale: organizerLocale,
            }),
          });
        } catch {
          /* email non blocca webhook */
        }
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      await this.syncSubscriptionPlanFromStripe(sub);
    }

    return { received: true };
  }
}
