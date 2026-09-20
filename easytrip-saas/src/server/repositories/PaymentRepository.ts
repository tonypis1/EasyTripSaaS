import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreatePaymentInput = {
  userId: string;
  tripId: string;
  type: "purchase" | "regen" | "reactivate";
  stripePaymentId: string;
  amount: number;
};

export class PaymentRepository {
  async create(input: CreatePaymentInput) {
    return prisma.payment.create({
      data: {
        userId: input.userId,
        tripId: input.tripId,
        type: input.type,
        stripePaymentId: input.stripePaymentId,
        amount: input.amount,
      },
    });
  }

  /**
   * Come `create`, ma atomico rispetto al vincolo UNIQUE su `stripePaymentId`:
   * ritorna `null` invece di lanciare quando un'altra richiesta concorrente
   * (es. redelivery del webhook Stripe in corsa con il fallback post-redirect)
   * ha già inserito il pagamento per lo stesso `stripePaymentId`. Va usato
   * ovunque `stripePaymentId` provenga da un evento Stripe potenzialmente
   * duplicato, al posto del solo check-then-insert applicativo.
   */
  async createIfNotDuplicate(input: CreatePaymentInput) {
    try {
      return await this.create(input);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return null;
      }
      throw e;
    }
  }

  async findByStripePaymentId(stripePaymentId: string) {
    return prisma.payment.findFirst({
      where: { stripePaymentId },
    });
  }
}
