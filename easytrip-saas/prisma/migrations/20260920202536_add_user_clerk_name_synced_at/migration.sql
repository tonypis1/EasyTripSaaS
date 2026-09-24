-- Throttle per la sincronizzazione User.name <- profilo Clerk (TripService
-- .syncMemberNamesFromClerkForTrip): senza questa colonna, ogni caricamento
-- della pagina trip richiamava l'API Clerk una volta per membro, in
-- sequenza, ad ogni singola richiesta. Ora si richiama Clerk solo per i
-- membri il cui nome non è stato verificato negli ultimi 15 minuti.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerk_name_synced_at" TIMESTAMP(3);
