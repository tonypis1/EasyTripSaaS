import { verifyWebhook } from "@clerk/backend/webhooks";
import { NextResponse } from "next/server";
import { config } from "@/config/unifiedConfig";
import { welcomeEmailHtml, sendTransactionalEmail } from "@/lib/email/transactional";
import {
  normalizeEmailLocale,
  t as trEmail,
} from "@/lib/email/email-i18n";
import { tryClaimWebhookDelivery } from "@/lib/email/webhookDelivery";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook Clerk: benvenuto post-registrazione (`user.created`).
 * Idempotenza: header `svix-id` univoco per consegna (Standard Webhooks).
 */
export async function POST(req: Request) {
  const secret = config.auth.clerkWebhookSigningSecret;
  if (!secret) {
    logger.warn("CLERK_WEBHOOK_SIGNING_SECRET non configurato");
    return NextResponse.json(
      { error: "Webhook Clerk non configurato" },
      { status: 503 },
    );
  }

  const svixId = req.headers.get("svix-id");
  if (!svixId?.trim()) {
    return NextResponse.json({ error: "svix-id mancante" }, { status: 400 });
  }

  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req, {
      signingSecret: secret,
    });
  } catch (e) {
    logger.error("Clerk webhook verify failed", e as Error);
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  if (evt.type !== "user.created") {
    return NextResponse.json({ received: true, ignored: evt.type });
  }

  const claimed = await tryClaimWebhookDelivery("clerk", svixId);
  if (!claimed) {
    return NextResponse.json({ received: true, skipped: "duplicate" });
  }

  const d = evt.data;
  const id = d.id;
  const emails = d.email_addresses;
  const primary =
    emails?.find((e) => e.id === d.primary_email_address_id) ?? emails?.[0];
  const email = primary?.email_address?.trim();

  if (!id || !email) {
    logger.warn("user.created senza id o email utilizzabile", { id });
    return NextResponse.json({ received: true, skipped: "no_email" });
  }

  const first = d.first_name ?? "";
  const last = d.last_name ?? "";
  const name = `${first} ${last}`.trim() || null;

  const user = await prisma.user.upsert({
    where: { clerkUserId: id },
    create: {
      clerkUserId: id,
      email,
      name: name ?? undefined,
    },
    update: { email, name: name ?? undefined },
  });

  if (user.welcomeEmailSentAt) {
    return NextResponse.json({ received: true, skipped: "welcome_sent" });
  }

  const appUrl = config.app.baseUrl;
  const locale = normalizeEmailLocale(user.language);
  try {
    await sendTransactionalEmail({
      to: email,
      subject: trEmail("subject.welcome", locale),
      html: welcomeEmailHtml({ name, appUrl, locale }),
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeEmailSentAt: new Date() },
    });
  } catch (e) {
    logger.error("Invio email benvenuto fallito", e as Error, { userId: user.id });
    throw e;
  }

  return NextResponse.json({ received: true });
}
