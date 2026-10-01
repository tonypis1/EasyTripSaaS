-- Trip: data del consenso esplicito (art. 9.2.a GDPR) alle preferenze sensibili
-- (restrizioni alimentari, esigenze di mobilità sanitarie).
--
-- Additiva: una colonna nullable, nessuna riscrittura della tabella. Il codice
-- precedente la ignora, quindi va applicata PRIMA del deploy del nuovo codice
-- (che la legge e la scrive). Le righe esistenti restano NULL.
ALTER TABLE "Trip" ADD COLUMN     "sensitive_prefs_consent_at" TIMESTAMP(3);
