-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "creatorWallet" TEXT;

-- CreateIndex
CREATE INDEX "Agent_creatorWallet_idx" ON "Agent"("creatorWallet");
