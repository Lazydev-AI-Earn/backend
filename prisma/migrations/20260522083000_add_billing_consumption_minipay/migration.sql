-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'CREDIT_PURCHASE';
ALTER TYPE "PaymentType" ADD VALUE 'AGENT_CONSUME';
ALTER TYPE "PaymentType" ADD VALUE 'CREATOR_PAYOUT';

-- AlterEnum
ALTER TYPE "AgentRunStep" ADD VALUE 'CONSUME';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'openai';

-- CreateTable
CREATE TABLE "CreditBalance" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "balanceCredits" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCredits" DECIMAL(36,18) NOT NULL,
    "amountUsd" DECIMAL(36,18),
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "txHash" TEXT,
    "metadata" JSONB,
    "relatedRentalId" TEXT,
    "relatedAgentId" TEXT,
    "relatedConsumptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConsumption" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "runId" TEXT,
    "userWallet" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "aiCostUsd" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "chargedCredits" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "creatorPayoutCredits" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "platformFeeCredits" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPayout" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "amountCredits" DECIMAL(36,18) NOT NULL,
    "amountUsd" DECIMAL(36,18),
    "tokenAddress" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "relatedConsumptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_userWallet_key" ON "CreditBalance"("userWallet");

-- CreateIndex
CREATE INDEX "CreditBalance_userWallet_idx" ON "CreditBalance"("userWallet");

-- CreateIndex
CREATE INDEX "CreditLedger_userWallet_idx" ON "CreditLedger"("userWallet");

-- CreateIndex
CREATE INDEX "CreditLedger_type_idx" ON "CreditLedger"("type");

-- CreateIndex
CREATE INDEX "CreditLedger_status_idx" ON "CreditLedger"("status");

-- CreateIndex
CREATE INDEX "CreditLedger_relatedRentalId_idx" ON "CreditLedger"("relatedRentalId");

-- CreateIndex
CREATE INDEX "CreditLedger_relatedConsumptionId_idx" ON "CreditLedger"("relatedConsumptionId");

-- CreateIndex
CREATE INDEX "AgentConsumption_rentalId_idx" ON "AgentConsumption"("rentalId");

-- CreateIndex
CREATE INDEX "AgentConsumption_agentId_idx" ON "AgentConsumption"("agentId");

-- CreateIndex
CREATE INDEX "AgentConsumption_runId_idx" ON "AgentConsumption"("runId");

-- CreateIndex
CREATE INDEX "AgentConsumption_userWallet_idx" ON "AgentConsumption"("userWallet");

-- CreateIndex
CREATE INDEX "AgentConsumption_status_idx" ON "AgentConsumption"("status");

-- CreateIndex
CREATE INDEX "CreatorPayout_creatorWallet_idx" ON "CreatorPayout"("creatorWallet");

-- CreateIndex
CREATE INDEX "CreatorPayout_status_idx" ON "CreatorPayout"("status");

-- CreateIndex
CREATE INDEX "CreatorPayout_relatedConsumptionId_idx" ON "CreatorPayout"("relatedConsumptionId");
