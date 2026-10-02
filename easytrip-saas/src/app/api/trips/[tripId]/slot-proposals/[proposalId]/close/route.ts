import { container } from "@/server/di/container";

const slotProposalController = container.controllers.slotProposalController;

/** POST /api/trips/[tripId]/slot-proposals/[proposalId]/close — Chiude subito la votazione con l'opzione in testa (solo organizzatore). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; proposalId: string }> },
) {
  const { tripId, proposalId } = await params;
  return slotProposalController.close(tripId, proposalId);
}
