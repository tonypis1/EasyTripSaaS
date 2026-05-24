-- Aggiunge un vincolo UNIQUE su (trip_id, version_num) della tabella TripVersion.
--
-- Prerequisito: aver bonificato eventuali duplicati storici lanciando
-- `npm run db:dedupe-trip-versions` (dry-run) e poi
-- `npm run db:dedupe-trip-versions:apply`. Senza quella bonifica, questa
-- migration fallisce su righe duplicate preesistenti.
--
-- Motivazione: il versionNum era derivato da `trip.regenCount + 1` nello step
-- Inngest "salva-versione-e-giorni"; in caso di retry dello step, era possibile
-- creare due TripVersion con lo stesso versionNum per lo stesso trip, da cui
-- l'errore "Encountered two children with the same key" nel carosello UI
-- (TripVersionCarousel). Questo vincolo blocca la classe di bug a livello DB.

-- CreateIndex
CREATE UNIQUE INDEX "TripVersion_tripId_versionNum_key" ON "TripVersion"("trip_id", "version_num");
