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
  waitlist: {
    initialCount: env.WAITLIST_INITIAL_COUNT,
    capacity: env.WAITLIST_CAPACITY,
  },
} as const;

