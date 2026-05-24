import { BaseController } from "@/server/controllers/BaseController";
import { SupportService } from "@/server/services/support/supportService";
import {
  createTicketSchema,
  addMessageSchema,
} from "@/server/validators/support.schema";

export class SupportController extends BaseController {
  constructor(private readonly supportService: SupportService) {
    super();
  }

  async create(req: Request) {
    try {
      const body = await req.json();
      const input = createTicketSchema.parse(body);
      const ticket = await this.supportService.createTicket(input);
      return this.ok(ticket, 201);
    } catch (error) {
      return this.fail(error, "SupportController.create");
    }
  }

  async list() {
    try {
      const tickets = await this.supportService.listMyTickets();
      return this.ok(tickets);
    } catch (error) {
      return this.fail(error, "SupportController.list");
    }
  }

  async getById(ticketId: string) {
    try {
      const ticket = await this.supportService.getTicket(ticketId);
      return this.ok(ticket);
    } catch (error) {
      return this.fail(error, "SupportController.getById");
    }
  }

  async addMessage(ticketId: string, req: Request) {
    try {
      const body = await req.json();
      const input = addMessageSchema.parse(body);
      const ticket = await this.supportService.addMessage(ticketId, input);
      return this.ok(ticket);
    } catch (error) {
      return this.fail(error, "SupportController.addMessage");
    }
  }

  async resolve(ticketId: string) {
    try {
      await this.supportService.resolveTicket(ticketId);
      return this.ok({ resolved: true });
    } catch (error) {
      return this.fail(error, "SupportController.resolve");
    }
  }
}
