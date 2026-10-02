import { BaseController } from "@/server/controllers/BaseController";
import { SlotProposalService } from "@/server/services/trip/slotProposalService";
import { castSlotVoteSchema } from "@/server/validators/slotProposal.schema";
import { parseJsonBody } from "@/server/controllers/parseJsonBody";

export class SlotProposalController extends BaseController {
  constructor(private readonly slotProposalService: SlotProposalService) {
    super();
  }

  async open(tripId: string, proposalId: string) {
    try {
      const proposal = await this.slotProposalService.open(tripId, proposalId);
      return this.ok(proposal);
    } catch (error) {
      return this.fail(error, "SlotProposalController.open");
    }
  }

  async vote(tripId: string, proposalId: string, req: Request) {
    try {
      const body = await parseJsonBody(req);
      const { optionIndex } = castSlotVoteSchema.parse(body);
      const outcome = await this.slotProposalService.vote(
        tripId,
        proposalId,
        optionIndex,
      );
      return this.ok(outcome);
    } catch (error) {
      return this.fail(error, "SlotProposalController.vote");
    }
  }

  async close(tripId: string, proposalId: string) {
    try {
      const outcome = await this.slotProposalService.close(tripId, proposalId);
      return this.ok(outcome);
    } catch (error) {
      return this.fail(error, "SlotProposalController.close");
    }
  }
}
