import { NextResponse } from "next/server";
import { incrementWaitlistCount } from "@/lib/waitlist-store";
import { logger } from "@/lib/observability";
import { AppError } from "@/server/errors/AppError";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const emailRaw = formData.get("email");
    const email = typeof emailRaw === "string" ? emailRaw.trim() : "";

    if (!email || !email.includes("@")) {
      throw new AppError("Email non valida", 400, "INVALID_EMAIL");
    }

    await incrementWaitlistCount();
    logger.info("Waitlist signup received", { email });

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

