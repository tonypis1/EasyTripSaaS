-- Postgres non indicizza automaticamente le colonne foreign key (a differenza
-- di MySQL/InnoDB): verificato che, a parte i vincoli @@unique esistenti (che
-- coprono solo tripId/referrerId come colonna sinistra), nessuna delle colonne
-- FK sottostanti aveva un indice. Ogni query che filtra per una di queste
-- colonne (dettaglio trip, storico pagamenti/crediti, saldo spese, ticket di
-- supporto) faceva un sequential scan, con degrado silenzioso alla crescita
-- delle tabelle. TripVersion.tripId e TripMember.tripId e Referral.referrerId
-- non hanno bisogno di un nuovo indice: sono già la colonna sinistra di un
-- vincolo UNIQUE composito esistente, usabile da Postgres per i lookup su
-- quella sola colonna (leftmost-prefix).

-- CreateIndex
CREATE INDEX "Credit_user_id_idx" ON "Credit"("user_id");

-- CreateIndex
CREATE INDEX "Credit_origin_trip_id_idx" ON "Credit"("origin_trip_id");

-- CreateIndex
CREATE INDEX "Credit_used_on_trip_id_idx" ON "Credit"("used_on_trip_id");

-- CreateIndex
CREATE INDEX "Day_trip_version_id_idx" ON "Day"("trip_version_id");

-- CreateIndex
CREATE INDEX "Expense_trip_id_idx" ON "Expense"("trip_id");

-- CreateIndex
CREATE INDEX "Expense_paid_by_id_idx" ON "Expense"("paid_by_id");

-- CreateIndex
CREATE INDEX "Payment_user_id_idx" ON "Payment"("user_id");

-- CreateIndex
CREATE INDEX "Payment_trip_id_idx" ON "Payment"("trip_id");

-- CreateIndex
CREATE INDEX "Trip_organizer_id_idx" ON "Trip"("organizer_id");

-- CreateIndex
CREATE INDEX "TripMember_user_id_idx" ON "TripMember"("user_id");

-- CreateIndex
CREATE INDEX "referral_referred_user_id_idx" ON "referral"("referred_user_id");

-- CreateIndex
CREATE INDEX "referral_reward_credit_id_idx" ON "referral"("reward_credit_id");

-- CreateIndex
CREATE INDEX "support_message_ticket_id_idx" ON "support_message"("ticket_id");

-- CreateIndex
CREATE INDEX "support_ticket_user_id_idx" ON "support_ticket"("user_id");

-- CreateIndex
CREATE INDEX "support_ticket_trip_id_idx" ON "support_ticket"("trip_id");
