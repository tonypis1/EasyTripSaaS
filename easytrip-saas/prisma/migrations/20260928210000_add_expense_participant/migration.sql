-- Split spese 2.0: attribuzione di una spesa ai membri che la condividono
-- (sottoinsieme e quote pesate). Una spesa senza righe resta divisa in parti
-- uguali tra tutti i membri: nessun backfill necessario per i dati esistenti.

-- CreateTable
CREATE TABLE "expense_participant" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,

    CONSTRAINT "expense_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_participant_member_id_idx" ON "expense_participant"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_participant_expense_id_member_id_key" ON "expense_participant"("expense_id", "member_id");

-- AddForeignKey
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "TripMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

