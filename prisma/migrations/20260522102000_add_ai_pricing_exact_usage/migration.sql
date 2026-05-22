-- Add exact usage and pricing snapshot fields for agent consumption billing.
ALTER TABLE "AgentConsumption"
ADD COLUMN "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inputUsdPerMillion" DECIMAL(36,18) NOT NULL DEFAULT 0,
ADD COLUMN "cachedInputUsdPerMillion" DECIMAL(36,18) NOT NULL DEFAULT 0,
ADD COLUMN "outputUsdPerMillion" DECIMAL(36,18) NOT NULL DEFAULT 0,
ADD COLUMN "aiCostCredits" DECIMAL(36,18) NOT NULL DEFAULT 0,
ADD COLUMN "usageSource" TEXT NOT NULL DEFAULT 'estimated',
ADD COLUMN "pricingSource" TEXT NOT NULL DEFAULT 'fallback',
ADD COLUMN "rawUsage" JSONB;

CREATE INDEX "AgentConsumption_provider_model_idx" ON "AgentConsumption"("provider", "model");

-- Store editable per-provider model pricing as USD per 1 million tokens.
CREATE TABLE "AiModelPricing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputUsdPerMillion" DECIMAL(36,18) NOT NULL,
    "cachedInputUsdPerMillion" DECIMAL(36,18),
    "outputUsdPerMillion" DECIMAL(36,18) NOT NULL,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelPricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiModelPricing_provider_model_key" ON "AiModelPricing"("provider", "model");
CREATE INDEX "AiModelPricing_provider_idx" ON "AiModelPricing"("provider");
CREATE INDEX "AiModelPricing_isActive_idx" ON "AiModelPricing"("isActive");

