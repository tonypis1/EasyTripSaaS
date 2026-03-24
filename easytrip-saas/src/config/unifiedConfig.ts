import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_SOLO_COUPLE_CENTS: z.coerce.number().int().positive().default(999),
  STRIPE_PRICE_GROUP_CENTS: z.coerce.number().int().positive().default(1499),
  ANTHROPIC_API_KEY: z.string().min(1),
  /**
   * ID esatto del modello (gli snapshot datati vengono ritirati: se ricevi 404 su "model", aggiorna qui).
   * Riferimento: https://docs.anthropic.com/en/docs/about-claude/models
   */
  ANTHROPIC_MODEL: z.string().min(1).optional(),

  WAITLIST_INITIAL_COUNT: z.coerce.number().int().nonnegative().default(847),
  WAITLIST_CAPACITY: z.coerce.number().int().positive().default(200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.flatten().formErrors.join(
      ", "
    )}`
  );
}

const env = parsed.data;

export const config = {
  app: {
    env: env.NODE_ENV,
    baseUrl: env.APP_BASE_URL,
  },
  db: {
    url: env.DATABASE_URL,
  },
  auth: {
    clerkPublishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: env.CLERK_SECRET_KEY,
  },
  billing: {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceSoloCoupleCents: env.STRIPE_PRICE_SOLO_COUPLE_CENTS,
    priceGroupCents: env.STRIPE_PRICE_GROUP_CENTS,
    currency: "eur" as const,
  },
  ai: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    /** Default: Sonnet 4 (sostituisce snapshot 3.5 spesso deprecati / non trovati). */
    anthropicModel:
      env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  },
  waitlist: {
    initialCount: env.WAITLIST_INITIAL_COUNT,
    capacity: env.WAITLIST_CAPACITY,
  },
} as const;

