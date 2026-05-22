import { z } from "zod";
import {
  optionalFutureDate,
  nonNegativeDecimalString,
  paginationQuery,
  positiveDecimalString,
  txHashSchema,
  uuidSchema,
  walletSchema,
} from "./common.js";

export const authNonceQuerySchema = z.object({
  wallet: walletSchema,
});

export const authVerifySchema = z.object({
  walletAddress: walletSchema,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature"),
});

export const bountyCreateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(20).max(20000),
  category: z.enum([
    "DEVELOPMENT",
    "RESEARCH",
    "CONTENT",
    "TRANSLATION",
    "QA_TESTING",
    "COMMUNITY",
    "DESIGN",
    "DATA",
    "WEB3_ANALYSIS",
  ]),
  requirements: z.union([z.array(z.string().trim().min(1)).min(1), z.record(z.any())]),
  submissionFormat: z.string().trim().max(500).optional(),
  rewardAmount: positiveDecimalString,
  rewardToken: z.string().trim().max(80).optional(),
  deadline: optionalFutureDate,
  metadataUri: z.string().trim().url().optional(),
});

export const bountyUpdateSchema = bountyCreateSchema.partial().extend({
  status: z
    .enum(["DRAFT", "OPEN", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"])
    .optional(),
});

export const bountyListQuerySchema = paginationQuery().extend({
  category: z.string().optional(),
  status: z.string().optional(),
  minReward: z.string().optional(),
  maxReward: z.string().optional(),
  search: z.string().trim().optional(),
});

export const agentRentalCreateSchema = z.object({
  bountyId: uuidSchema,
  agentId: uuidSchema,
  mode: z.enum(["ANALYZE_ONLY", "SOLVE_DRAFT", "SOLVE_REVIEW", "AUTO_SUBMIT"]),
  autoSubmitEnabled: z.boolean().optional().default(false),
  paymentTxHash: txHashSchema,
});

export const agentConsumeSchema = z.object({
  input: z.string().trim().min(1).max(20000),
  context: z.record(z.any()).optional().default({}),
});

export const submissionCreateSchema = z.object({
  bountyId: uuidSchema,
  rentalId: uuidSchema.optional(),
  content: z.string().trim().min(10).max(50000),
  proofUrl: z.string().trim().url().optional(),
});

const agentCategorySchema = z.enum([
  "CORE",
  "RESEARCH",
  "CONTENT",
  "TRANSLATION",
  "QA",
  "WEB3_ANALYSIS",
  "DEVELOPMENT",
  "SUBMISSION",
]);

const agentTypeSchema = z.enum(["ANALYZER", "SOLVER", "REVIEWER", "REVISION", "SUBMITTER", "BUILDER"]);

export const agentBaseSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(10).max(2000),
  category: agentCategorySchema,
  agentType: agentTypeSchema,
  aiProvider: z.enum(["openai", "anthropic", "openai-compatible"]).optional().default("openai"),
  systemPrompt: z.string().trim().min(20).max(20000),
  model: z.string().trim().max(120).optional(),
  price: nonNegativeDecimalString.default("0"),
  paymentToken: z.string().trim().max(120).optional(),
});

export const agentCreateSchema = agentBaseSchema.extend({
  chainAgentId: z.string().trim().optional(),
  isOfficial: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const agentUpdateSchema = agentCreateSchema.partial();

export const userAgentCreateSchema = agentBaseSchema;

export const userAgentUpdateSchema = agentBaseSchema
  .omit({ slug: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one editable field is required",
  });

export const agentListQuerySchema = z.object({
  officialOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  category: agentCategorySchema.optional(),
  agentType: agentTypeSchema.optional(),
  creatorWallet: walletSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export const idParamsSchema = z.object({
  id: uuidSchema,
});

export const bountySubmissionParamsSchema = z.object({
  id: uuidSchema,
  submissionId: uuidSchema,
});

export const walletParamsSchema = z.object({
  wallet: walletSchema,
});

export const creditPurchaseSchema = z.object({
  amountCredits: positiveDecimalString,
  tokenSymbol: z.enum(["USDC", "USDT", "USDm"]).default("USDC"),
  tokenAddress: z.string().trim().optional(),
  txHash: txHashSchema,
});

export const aiPricingQuerySchema = z.object({
  provider: z.enum(["openai", "anthropic"]).optional(),
  model: z.string().trim().max(120).optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});

export const aiPricingCreateSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().trim().min(2).max(160),
  inputUsdPerMillion: nonNegativeDecimalString,
  cachedInputUsdPerMillion: nonNegativeDecimalString.optional(),
  outputUsdPerMillion: nonNegativeDecimalString,
  sourceUrl: z.string().trim().url().optional(),
  sourceNote: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional().default(true),
  effectiveAt: z.string().datetime().optional(),
});

export const aiPricingUpdateSchema = aiPricingCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "At least one pricing field is required",
});
