import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Health check per synthetic monitoring e `npm run postdeploy:check`. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const inngestConfigured = Boolean(
    process.env.INNGEST_SIGNING_KEY?.trim() &&
    process.env.INNGEST_EVENT_KEY?.trim(),
  );

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "up",
      inngest: { configured: inngestConfigured },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        inngest: { configured: inngestConfigured },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
