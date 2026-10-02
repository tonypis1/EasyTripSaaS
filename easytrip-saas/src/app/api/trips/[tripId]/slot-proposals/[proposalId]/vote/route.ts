import { container } from "@/server/di/container";

const slotProposalController = container.controllers.slotProposalController;

/** POST /api/trips/[tripId]/slot-proposals/[proposalId]/vote — Body: { "optionIndex": 0..3 } */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string; proposalId: string }> },
) {
  const { tripId, proposalId } = await params;
  return slotProposalController.vote(tripId, proposalId, req);
}
