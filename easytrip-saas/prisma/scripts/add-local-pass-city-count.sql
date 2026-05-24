-- Aggiunge local_pass_city_count su "Trip" se manca (allinea schema Prisma senza toccare waitlist).
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "local_pass_city_count" INTEGER NOT NULL DEFAULT 0;
