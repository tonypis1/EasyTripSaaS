import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Registra un evento webhook una sola volta. Ritorna `true` se questo è il primo
 * processamento (ok procedere), `false` se già visto (idempotenza).
 */
export async function tryClaimWebhookDelivery(
  provider: "stripe" | "clerk",
  externalId: string,
): Promise<boolean> {
  try {
    await prisma.webhookDelivery.create({
      data: { provider, externalId },
    });
    return true;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return false;
    }
    throw e;
  }
}
