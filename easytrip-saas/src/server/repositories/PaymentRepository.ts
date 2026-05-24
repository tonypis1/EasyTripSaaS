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

  async findByStripePaymentId(stripePaymentId: string) {
    return prisma.payment.findFirst({
      where: { stripePaymentId },
    });
  }
}
