import { AuthService } from "@/server/services/auth/authService";
import { SupportRepository } from "@/server/repositories/SupportRepository";
import { AppError } from "@/server/errors/AppError";
import type { CreateTicketInput, AddMessageInput } from "@/server/validators/support.schema";

export type TicketDto = {
  id: string;
  subject: string;
  channel: string;
  status: string;
  tripId: string | null;
  tripDestination: string | null;
  createdAt: string;
  resolvedAt: string | null;
  messages: {
    id: string;
    sender: string;
    body: string;
    createdAt: string;
  }[];
};

export class SupportService {
  constructor(
    private readonly authService: AuthService,
    private readonly supportRepository: SupportRepository,
  ) {}

  async createTicket(input: CreateTicketInput): Promise<TicketDto> {
    const user = await this.authService.getOrCreateCurrentUser();

    const ticket = await this.supportRepository.createWithMessage({
      userId: user.id,
      tripId: input.tripId,
      subject: input.subject,
      firstMessage: input.message,
      channel: input.channel as "chat" | "email" | "in_app",
    });

    return this.toDto(ticket);
  }

  async getTicket(ticketId: string): Promise<TicketDto> {
    const user = await this.authService.getOrCreateCurrentUser();

    const ticket = await this.supportRepository.findByIdForUser(
      ticketId,
      user.id,
    );
    if (!ticket) {
      throw new AppError("Ticket non trovato", 404, "TICKET_NOT_FOUND");
    }

    return this.toDto(ticket);
  }

  async listMyTickets(): Promise<TicketDto[]> {
    const user = await this.authService.getOrCreateCurrentUser();
    const tickets = await this.supportRepository.listByUser(user.id);
    return tickets.map((t) => this.toDto(t));
  }

  async addMessage(ticketId: string, input: AddMessageInput): Promise<TicketDto> {
    const user = await this.authService.getOrCreateCurrentUser();

    const ticket = await this.supportRepository.findByIdForUser(
      ticketId,
      user.id,
    );
    if (!ticket) {
      throw new AppError("Ticket non trovato", 404, "TICKET_NOT_FOUND");
    }
    if (ticket.status === "closed" || ticket.status === "resolved") {
      throw new AppError(
        "Il ticket è già chiuso",
        400,
        "TICKET_CLOSED",
      );
    }

    await this.supportRepository.addMessage(ticketId, "user", input.body);

    const updated = await this.supportRepository.findByIdForUser(
      ticketId,
      user.id,
    );
    return this.toDto(updated!);
  }

  async resolveTicket(ticketId: string): Promise<void> {
    const user = await this.authService.getOrCreateCurrentUser();

    const ticket = await this.supportRepository.findByIdForUser(
      ticketId,
      user.id,
    );
    if (!ticket) {
      throw new AppError("Ticket non trovato", 404, "TICKET_NOT_FOUND");
    }

    await this.supportRepository.resolve(ticketId, user.id);
  }

  private toDto(ticket: {
    id: string;
    subject: string;
    channel: string;
    status: string;
    tripId: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    trip?: { id: string; destination: string } | null;
    messages: { id: string; sender: string; body: string; createdAt: Date }[];
  }): TicketDto {
    return {
      id: ticket.id,
      subject: ticket.subject,
      channel: ticket.channel,
      status: ticket.status,
      tripId: ticket.tripId,
      tripDestination: ticket.trip?.destination ?? null,
      createdAt: ticket.createdAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
