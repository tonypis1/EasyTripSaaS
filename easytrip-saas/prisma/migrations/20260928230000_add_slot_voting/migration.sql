-- Group voting sulle alternative di SlotReplace: una proposta per slot con le
-- opzioni (contenuto attuale + alternative AI) e un voto per membro.
-- Solo tabelle nuove: nessun impatto sui dati esistenti.

-- CreateEnum
CREATE TYPE "SlotProposalStatus" AS ENUM ('draft', 'open', 'resolved', 'cancelled');

-- CreateTable
CREATE TABLE "slot_proposal" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "slot_key" TEXT NOT NULL,
    "status" "SlotProposalStatus" NOT NULL DEFAULT 'draft',
    "options" JSONB NOT NULL,
    "winner_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "slot_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_vote" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "option_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_proposal_day_id_slot_key_idx" ON "slot_proposal"("day_id", "slot_key");

-- CreateIndex
CREATE INDEX "slot_proposal_status_expires_at_idx" ON "slot_proposal"("status", "expires_at");

-- CreateIndex
CREATE INDEX "slot_vote_member_id_idx" ON "slot_vote"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_vote_proposal_id_member_id_key" ON "slot_vote"("proposal_id", "member_id");

-- AddForeignKey
ALTER TABLE "slot_proposal" ADD CONSTRAINT "slot_proposal_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_vote" ADD CONSTRAINT "slot_vote_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "slot_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_vote" ADD CONSTRAINT "slot_vote_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "TripMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

