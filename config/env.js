export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || process.env.APP_PORT || 5050),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  mockAi: process.env.MOCK_AI !== "false",
  mockPayments: process.env.MOCK_PAYMENTS !== "false",
  startWorkers: process.env.START_WORKERS !== "false",
  aiProvider: process.env.AI_PROVIDER || "openai",
  aiModel: process.env.AI_MODEL || "gpt-4o-mini",
  aiBaseUrl: process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
  anthropicVersion: process.env.ANTHROPIC_VERSION || "2023-06-01",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  creditUsdValue: Number(process.env.CREDIT_USD_VALUE || 0.01),
  creatorRevenueShareBps: Number(process.env.CREATOR_REVENUE_SHARE_BPS || 6000),
  defaultAiMarkupBps: Number(process.env.DEFAULT_AI_MARKUP_BPS || 25000),
  minimumConsumeChargeCredits: Number(process.env.MIN_CONSUME_CHARGE_CREDITS || 1),
  aiPricingJson: process.env.AI_PRICING_JSON,
  minipayAppId: process.env.MINIPAY_APP_ID,
  minipaySupportedTokensJson: process.env.MINIPAY_SUPPORTED_TOKENS_JSON,
  rpcUrl: process.env.RPC_URL,
  celoChainId: Number(process.env.CELO_CHAIN_ID || 42220),
  bountyContractAddress: process.env.BOUNTY_CONTRACT_ADDRESS,
  agentRentalContractAddress: process.env.AGENT_RENTAL_CONTRACT_ADDRESS,
  treasuryAddress: process.env.TREASURY_ADDRESS,
};

export function requireJwtSecret() {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
  return env.jwtSecret;
}
