import { NextResponse } from "next/server";
import { container } from "@/server/di/container";

/**
 * Portabilità dati (GDPR Art. 20): export JSON dell’utente autenticato.
 */
export async function GET() {
  const auth = container.services.authService;
  const privacy = container.services.userDataService;

  const user = await auth.getOrCreateCurrentUser();
  const data = await privacy.exportAllDataForUserId(user.id);

  return NextResponse.json(
    { ok: true, data },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="easytrip-data-export-${user.id}.json"`,
      },
    },
  );
}
