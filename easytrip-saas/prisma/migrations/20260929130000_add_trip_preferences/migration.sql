-- Preferenze strutturate del viaggio (interessi, ritmo, mobilità, restrizioni alimentari).
--
-- Migrazione additiva: 4 colonne nuove su "Trip", tutte con default (elenchi vuoti / NULL).
-- Con un DEFAULT costante PostgreSQL non riscrive la tabella e le righe esistenti risultano
-- subito con elenco vuoto. Elenchi di testo (non enum DB) di proposito: aggiungere
-- un'opzione non richiede una migrazione; le chiavi valide sono in src/lib/trip/preferences.ts.
--
-- Ordine di deploy: applicare la migrazione PRIMA del nuovo codice. Il codice precedente
-- ignora le colonne nuove (default), ma il codice nuovo le legge in ogni query sui viaggi
-- e fallirebbe se la migrazione non fosse ancora stata applicata.

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "dietary_restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mobility_needs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pace" TEXT;
