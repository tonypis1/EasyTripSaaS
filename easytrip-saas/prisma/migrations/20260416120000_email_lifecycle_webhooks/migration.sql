-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('stripe', 'clerk');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "marketing_opt_in_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "welcome_email_sent_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "nurture_no_trip_3_sent_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "nurture_no_trip_7_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_provider_external_id_key" ON "webhook_delivery"("provider", "external_id");
