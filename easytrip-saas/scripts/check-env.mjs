#!/usr/bin/env node
/**
 * Controlla che le variabili d'ambiente richieste siano impostate (non stampa valori).
 *
 * Uso:
 *   node scripts/check-env.mjs              # elenco + exit 0
 *   node scripts/check-env.mjs --strict    # solo core Zod; exit 1 se manca qualcosa
 *   node scripts/check-env.mjs --production # core + Inngest + Clerk webhook + email transazionale
 */

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const production = args.includes("--production");

/** Allineato a src/config/unifiedConfig.ts (campi obbligatori nello schema). */
const requiredCore = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
];

/** Consigliate per go-live produzione (oltre unifiedConfig). */
const recommendedProduction = [
  "APP_BASE_URL",
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

function missing(keys) {
  return keys.filter((k) => {
    const v = process.env[k];
    return v === undefined || String(v).trim() === "";
  });
}

function section(title, keys) {
  const m = missing(keys);
  console.log(`\n${title}`);
  for (const k of keys) {
    const ok = !m.includes(k);
    console.log(`  ${ok ? "✓" : "✗"} ${k}`);
  }
  return m;
}

console.log("EasyTrip — controllo variabili d'ambiente\n");

section("Core (schema app)", requiredCore);
section("Consigliate produzione", recommendedProduction);

section("Opzionali (servizi)", [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_CRISP_WEBSITE_ID",
  "NEXT_PUBLIC_BOOKING_AID",
  "NEXT_PUBLIC_GYG_PARTNER_ID",
  "NEXT_PUBLIC_THEFORK_PARTNER_ID",
  "NEXT_PUBLIC_VIATOR_PID",
  "NEXT_PUBLIC_AMAZON_TAG",
  "STRIPE_SUBSCRIPTION_PRICE_ID",
  "ANTHROPIC_MODEL",
]);

if (!strict && !production) {
  console.log(
    "\nNessun flag: solo report. Usa --strict (core) o --production (go-live).\n",
  );
  process.exit(0);
}

const toCheck = production
  ? [...requiredCore, ...recommendedProduction]
  : requiredCore;
const fail = missing(toCheck);

if (fail.length > 0) {
  console.error("\nVariabili mancanti o vuote:");
  for (const k of fail) console.error(`  - ${k}`);
  console.error(
    "\nVedi .env.example e architecture-docs/13_CICD_SECRETS_AND_DNS.md\n",
  );
  process.exit(1);
}

console.log("\nTutti i controlli richiesti sono OK.\n");
process.exit(0);
