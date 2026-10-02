-- Cache condivisa di POI/ristoranti verificati via ricerca web (grounding della
-- generazione itinerari): una riga per destinazione, riusata da tutti gli utenti
-- che generano per la stessa città. Solo dati pubblici, nessun dato personale.

-- CreateTable
CREATE TABLE "verified_poi_cache" (
    "id" TEXT NOT NULL,
    "destination_key" TEXT NOT NULL,
    "destination_label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_poi_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verified_poi_cache_destination_key_key" ON "verified_poi_cache"("destination_key");

-- CreateIndex
CREATE INDEX "verified_poi_cache_expires_at_idx" ON "verified_poi_cache"("expires_at");

