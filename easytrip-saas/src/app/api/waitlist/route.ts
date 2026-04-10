import { NextResponse } from "next/server";
import { incrementWaitlistCount } from "@/lib/waitlist-store";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/observability";
import { redactEmail } from "@/lib/redact-pii";
import { AppError } from "@/server/errors/AppError";
import {
  enforceRateLimit,
  getClientIp,
  waitlistLimiter,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = await enforceRateLimit(
    waitlistLimiter,
    `waitlist:${getClientIp(req)}`,
  );
  if (rl) return rl;

  try {
    const formData = await req.formData();
    const emailRaw = formData.get("email");
    const email =
      typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      throw new AppError("Email non valida", 400, "INVALID_EMAIL");
    }

    const entry = await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    await incrementWaitlistCount();

    if (entry.dripSent === 0) {
      try {
        await inngest.send({
          name: "waitlist/signup",
          // Solo ID: l'email resta nel DB; evita PII nel payload Inngest (Privacy by Design).
          data: { waitlistEntryId: entry.id },
        });
      } catch (inngestErr) {
        logger.error(
          "Inngest event send failed (drip will not start)",
          inngestErr,
        );
      }
    }

    logger.info("Waitlist signup received", {
      email: redactEmail(email),
      entryId: entry.id,
    });

    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("waitlist", "ok");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error("Waitlist signup failed", error);
    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("waitlist", "error");
    return NextResponse.redirect(redirectUrl);
  }
}
