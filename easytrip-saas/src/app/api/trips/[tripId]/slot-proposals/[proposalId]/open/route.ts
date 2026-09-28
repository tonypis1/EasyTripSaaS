import { container } from "@/server/di/container";

const slotProposalController = container.controllers.slotProposalController;

/** POST /api/trips/[tripId]/slot-proposals/[proposalId]/open — Apre al voto del gruppo la bozza generata dalla sostituzione di uno slot (solo organizzatore). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; proposalId: string }> },
) {
  const { tripId, proposalId } = await params;
  return slotProposalController.open(tripId, proposalId);
}
