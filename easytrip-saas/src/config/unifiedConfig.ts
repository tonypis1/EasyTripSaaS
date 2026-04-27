import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /**
   * URL pubblico dell’app (redirect Stripe Checkout, link email/Inngest/referral).
   * Locale: `http://localhost:3000`. Produzione: `https://easytripsaas.com` (Vercel + DNS).
   * Impostare in Vercel → Environment Variables. Dettagli: `architecture-docs/12_DEPLOYMENT.md`, `13_CICD_SECRETS_AND_DNS.md`.
   */
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  /** Signing secret del webhook Clerk (Dashboard → Webhooks). Opzionale: senza, /api/webhooks/clerk risponde 503. */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_SOLO_COUPLE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(999),
  STRIPE_PRICE_GROUP_CENTS: z.coerce.number().int().positive().default(1499),
  /** Rigenerazione itinerario (default €1,99). */
  STRIPE_PRICE_REGEN_CENTS: z.coerce.number().int().positive().default(199),
  /** Riattivazione accesso post-trip (default €2,90). */
  STRIPE_PRICE_REACTIVATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(290),
  /** Add-on LocalPass per città (default €3,99). */
  STRIPE_PRICE_LOCALPASS_CENTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(399),

  /**
   * Price ID Stripe dell'abbonamento mensile (se impostato, il webhook subscription
   * aggiorna il piano solo per questo prodotto).
   */
  STRIPE_SUBSCRIPTION_PRICE_ID: z.string().optional(),

  /** Resend.com — opzionale; se assente le email transazionali sono solo loggate in dev. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  /**
   * ID esatto del modello (gli snapshot datati vengono ritirati: se ricevi 404 su "model", aggiorna qui).
   * Riferimento: https://docs.anthropic.com/en/docs/about-claude/models
   */
  ANTHROPIC_MODEL: z.string().min(1).optional(),

  /** Giorni dopo cui eliminare versioni itinerario non attive (solo storico carosello). */
  RETENTION_INACTIVE_TRIP_VERSION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(365),
  /** Giorni dopo soft-delete prima di rimuovere definitivamente il trip dal DB. */
  RETENTION_SOFT_DELETED_TRIP_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(90),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const { fieldErrors, formErrors } = parsed.error.flatten();
  const parts = [
    ...formErrors,
    ...Object.entries(fieldErrors).flatMap(([key, errors]) =>
      errors?.length ? [`${key}: ${errors.join(", ")}`] : [],
    ),
  ];
  const detail = parts.length > 0 ? parts.join("; ") : parsed.error.message;
  throw new Error(
    `Invalid environment configuration. ${detail} (Set these in Vercel: Project → Settings → Environment Variables.)`,
  );
}

const env = parsed.data;

/** Evita `https://dominio.com//app/...` se `APP_BASE_URL` ha slash finale in Vercel. */
const appBaseUrl = env.APP_BASE_URL.replace(/\/+$/, "");

export const config = {
  app: {
    env: env.NODE_ENV,
    baseUrl: appBaseUrl,
  },
  db: {
    url: env.DATABASE_URL,
  },
  auth: {
    clerkPublishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: env.CLERK_SECRET_KEY,
    clerkWebhookSigningSecret: env.CLERK_WEBHOOK_SIGNING_SECRET ?? null,
  },
  billing: {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceSoloCoupleCents: env.STRIPE_PRICE_SOLO_COUPLE_CENTS,
    priceGroupCents: env.STRIPE_PRICE_GROUP_CENTS,
    priceRegenCents: env.STRIPE_PRICE_REGEN_CENTS,
    priceReactivateCents: env.STRIPE_PRICE_REACTIVATE_CENTS,
    priceLocalPassCents: env.STRIPE_PRICE_LOCALPASS_CENTS,
    /** Abbonamento SaaS (opzionale). */
    stripeSubscriptionPriceId: env.STRIPE_SUBSCRIPTION_PRICE_ID ?? null,
    currency: "eur" as const,
  },
  email: {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  },
  ai: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    /** Default: Sonnet 4 (sostituisce snapshot 3.5 spesso deprecati / non trovati). */
    anthropicModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  },
  retention: {
    inactiveTripVersionDays: env.RETENTION_INACTIVE_TRIP_VERSION_DAYS,
    softDeletedTripDays: env.RETENTION_SOFT_DELETED_TRIP_DAYS,
  },
} as const;
