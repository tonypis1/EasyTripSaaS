import { prisma } from "@/lib/prisma";
import type { TicketChannel } from "@prisma/client";

type CreateTicketDb = {
  userId: string;
  tripId?: string;
  subject: string;
  firstMessage: string;
  channel: TicketChannel;
};

export class SupportRepository {
  async createWithMessage(input: CreateTicketDb) {
    return prisma.supportTicket.create({
      data: {
        userId: input.userId,
        tripId: input.tripId ?? null,
        subject: input.subject,
        channel: input.channel,
        status: "open",
        messages: {
          create: {
            sender: "user",
            body: input.firstMessage,
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async addMessage(ticketId: string, sender: string, body: string) {
    return prisma.supportMessage.create({
      data: { ticketId, sender, body },
    });
  }

  async findByIdForUser(ticketId: string, userId: string) {
    return prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        trip: { select: { id: true, destination: true } },
      },
    });
  }

  async listByUser(userId: string) {
    return prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        trip: { select: { id: true, destination: true } },
      },
    });
  }

  async resolve(ticketId: string, userId: string) {
    return prisma.supportTicket.updateMany({
      where: { id: ticketId, userId },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  }
}
