import { prisma } from "@/lib/prisma";

type CreatePaymentInput = {
  userId: string;
  tripId: string;
  type: "purchase" | "regen";
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
}

