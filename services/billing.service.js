import { env } from "../config/env.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";
import { prisma } from "./prisma.js";
import { resolveModel, resolveProvider } from "./ai.service.js";
import { verifyMiniPayCreditPayment } from "./blockchain.service.js";
import { OFFICIAL_AI_MODEL_PRICING } from "../config/ai-pricing.js";

const DEFAULT_PRICING = pricingArrayToCatalog(OFFICIAL_AI_MODEL_PRICING);

export async function getBillingAccount(user) {
  const [balance, ledger, consumptions, payouts] = await Promise.all([
    getOrCreateCreditBalance(user.walletAddress),
    prisma.creditLedger.findMany({
      where: { userWallet: user.walletAddress },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.agentConsumption.findMany({
      where: { userWallet: user.walletAddress },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creatorPayout.findMany({
      where: { creatorWallet: user.walletAddress },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    creditUsdValue: env.creditUsdValue,
    creatorRevenueShareBps: env.creatorRevenueShareBps,
    balance,
    recentLedger: ledger,
    recentConsumptions: consumptions,
    creatorPayouts: payouts,
  };
}

export async function createMiniPayCreditPurchase(user, data) {
  const amountCredits = toNumber(data.amountCredits);
  if (amountCredits <= 0) {
    throw new HttpError(400, "amountCredits must be greater than zero", "Bad Request");
  }

  const amountUsd = roundMoney(amountCredits * env.creditUsdValue);
  const verified = env.mockPayments
    ? true
    : await verifyMiniPayCreditPayment(data.txHash, amountUsd, user.walletAddress, data.tokenAddress);
  const status = verified ? "CONFIRMED" : "PENDING";

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userWallet: user.walletAddress,
        type: "CREDIT_PURCHASE",
        amount: String(amountUsd),
        tokenAddress: data.tokenAddress || data.tokenSymbol,
        txHash: data.txHash,
        status,
      },
    });

    let balance = await tx.creditBalance.findUnique({ where: { userWallet: user.walletAddress } });
    if (!balance) {
      balance = await tx.creditBalance.create({
        data: { userWallet: user.walletAddress, balanceCredits: "0" },
      });
    }

    if (status === "CONFIRMED") {
      balance = await tx.creditBalance.update({
        where: { userWallet: user.walletAddress },
        data: { balanceCredits: { increment: String(amountCredits) } },
      });
    }

    await tx.creditLedger.create({
      data: {
        userWallet: user.walletAddress,
        type: "CREDIT_PURCHASE",
        amountCredits: String(status === "CONFIRMED" ? amountCredits : 0),
        amountUsd: String(amountUsd),
        status,
        txHash: data.txHash,
        metadata: {
          source: "minipay",
          tokenSymbol: data.tokenSymbol,
          tokenAddress: data.tokenAddress || null,
          paymentId: payment.id,
        },
      },
    });

    return {
      payment,
      balance,
      credited: status === "CONFIRMED",
      creditUsdValue: env.creditUsdValue,
    };
  });
}

export async function ensureMinimumCredits(userWallet) {
  const balance = await getOrCreateCreditBalance(userWallet);
  if (toNumber(balance.balanceCredits) < env.minimumConsumeChargeCredits) {
    throw new HttpError(402, "Insufficient credits", "Payment Required");
  }
  return balance;
}

export function estimateAiUsage(input, output) {
  return {
    inputTokens: estimateTokens(input),
    cachedInputTokens: 0,
    outputTokens: estimateTokens(output),
    totalTokens: estimateTokens(input) + estimateTokens(output),
    usageSource: "estimated",
    rawUsage: null,
  };
}

export async function calculateConsumptionCharge({
  agent,
  inputTokens,
  cachedInputTokens = 0,
  outputTokens,
  usageSource = "estimated",
  rawUsage = null,
}) {
  const provider = resolveProvider(agent);
  const model = resolveModel(agent, provider);
  const pricing = await pricingForModel(provider, model);
  const inputUsdPerMillion = toNumber(pricing.inputUsdPerMillion);
  const cachedInputUsdPerMillion = toNumber(pricing.cachedInputUsdPerMillion ?? pricing.inputUsdPerMillion);
  const outputUsdPerMillion = toNumber(pricing.outputUsdPerMillion);
  const aiCostUsd = roundMoney(
    (inputTokens / 1_000_000) * inputUsdPerMillion +
      (cachedInputTokens / 1_000_000) * cachedInputUsdPerMillion +
      (outputTokens / 1_000_000) * outputUsdPerMillion
  );
  const markupBps = markupForModel(model);
  const grossUsd = roundMoney(Math.max(aiCostUsd * (markupBps / 10_000), env.minimumConsumeChargeCredits * env.creditUsdValue));
  const chargedCredits = roundCredits(grossUsd / env.creditUsdValue);
  const aiCostCredits = roundCredits(aiCostUsd / env.creditUsdValue);
  const netCredits = Math.max(0, chargedCredits - aiCostCredits);
  const creatorPayoutCredits =
    agent.isOfficial || !agent.creatorWallet
      ? 0
      : roundCredits((netCredits * env.creatorRevenueShareBps) / 10_000);
  const platformFeeCredits = roundCredits(Math.max(0, chargedCredits - aiCostCredits - creatorPayoutCredits));

  return {
    provider,
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    inputUsdPerMillion,
    cachedInputUsdPerMillion,
    outputUsdPerMillion,
    aiCostUsd,
    aiCostCredits,
    chargedCredits,
    creatorPayoutCredits,
    platformFeeCredits,
    markupBps,
    creditUsdValue: env.creditUsdValue,
    usageSource,
    pricingSource: pricing.pricingSource,
    rawUsage,
  };
}

export async function settleConsumptionCharge({ userWallet, rental, agent, run, charge }) {
  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userWallet } });
    if (!balance || toNumber(balance.balanceCredits) < charge.chargedCredits) {
      throw new HttpError(402, "Insufficient credits for AI consumption", "Payment Required");
    }

    const consumption = await tx.agentConsumption.create({
      data: {
        rentalId: rental.id,
        agentId: agent.id,
        runId: run.id,
        userWallet,
        provider: charge.provider,
        model: charge.model,
        inputTokens: charge.inputTokens,
        cachedInputTokens: charge.cachedInputTokens,
        outputTokens: charge.outputTokens,
        inputUsdPerMillion: String(charge.inputUsdPerMillion),
        cachedInputUsdPerMillion: String(charge.cachedInputUsdPerMillion),
        outputUsdPerMillion: String(charge.outputUsdPerMillion),
        aiCostUsd: String(charge.aiCostUsd),
        aiCostCredits: String(charge.aiCostCredits),
        chargedCredits: String(charge.chargedCredits),
        creatorPayoutCredits: String(charge.creatorPayoutCredits),
        platformFeeCredits: String(charge.platformFeeCredits),
        usageSource: charge.usageSource,
        pricingSource: charge.pricingSource,
        rawUsage: charge.rawUsage,
        status: "COMPLETED",
      },
    });

    const updatedBalance = await tx.creditBalance.update({
      where: { userWallet },
      data: { balanceCredits: { decrement: String(charge.chargedCredits) } },
    });

    await tx.creditLedger.create({
      data: {
        userWallet,
        type: "AGENT_CONSUME_CHARGE",
        amountCredits: String(-charge.chargedCredits),
        amountUsd: String(roundMoney(charge.chargedCredits * env.creditUsdValue)),
        status: "CONFIRMED",
        relatedRentalId: rental.id,
        relatedAgentId: agent.id,
        relatedConsumptionId: consumption.id,
        metadata: {
          runId: run.id,
          provider: charge.provider,
          model: charge.model,
          usageSource: charge.usageSource,
          pricingSource: charge.pricingSource,
          aiCostUsd: charge.aiCostUsd,
          aiCostCredits: charge.aiCostCredits,
          creatorPayoutCredits: charge.creatorPayoutCredits,
          platformFeeCredits: charge.platformFeeCredits,
        },
      },
    });

    let payout = null;
    if (charge.creatorPayoutCredits > 0) {
      payout = await tx.creatorPayout.create({
        data: {
          creatorWallet: agent.creatorWallet,
          amountCredits: String(charge.creatorPayoutCredits),
          amountUsd: String(roundMoney(charge.creatorPayoutCredits * env.creditUsdValue)),
          status: "PENDING",
          relatedConsumptionId: consumption.id,
        },
      });
    }

    return { consumption, balance: updatedBalance, payout };
  });
}

export async function listConsumptions(user, query = {}) {
  const where = {};
  if (!isAdmin(user)) where.userWallet = user.walletAddress;
  if (query.rentalId) where.rentalId = query.rentalId;
  return prisma.agentConsumption.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listCreatorPayouts(user, walletAddress) {
  if (!isAdmin(user) && !isSameWallet(user, walletAddress)) {
    throw new HttpError(403, "Payout access denied", "Forbidden");
  }
  return prisma.creatorPayout.findMany({
    where: { creatorWallet: walletAddress.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
}

export function getBusinessModel() {
  return {
    creditUsdValue: env.creditUsdValue,
    creatorRevenueShareBps: env.creatorRevenueShareBps,
    platformRevenueShareBps: 10_000 - env.creatorRevenueShareBps,
    defaultAiMarkupBps: env.defaultAiMarkupBps,
    minimumConsumeChargeCredits: env.minimumConsumeChargeCredits,
    formula: {
      aiCostUsd: "input_tokens * input_price + cached_input_tokens * cached_input_price + output_tokens * output_price",
      renterCharge: "max(ai_cost_usd * markup, minimum_consume_charge)",
      creatorPayout: "user-created agents receive creator share from net revenue after AI cost",
      platformFee: "charged credits minus AI cost credits minus creator payout credits",
    },
    settlementCurrency: "internal credits",
    depositRail: "MiniPay stablecoin Deposit on Celo",
  };
}

export async function listAiPricing(query = {}) {
  const where = {};
  if (query.provider) where.provider = String(query.provider).toLowerCase();
  if (query.model) where.model = { contains: query.model, mode: "insensitive" };
  if (query.activeOnly === "true" || query.activeOnly === true) where.isActive = true;
  return prisma.aiModelPricing.findMany({
    where,
    orderBy: [{ provider: "asc" }, { model: "asc" }],
  });
}

export async function createAiPricing(data) {
  const provider = String(data.provider).toLowerCase();
  const model = String(data.model).trim();
  try {
    return await prisma.aiModelPricing.create({
      data: {
        provider,
        model,
        inputUsdPerMillion: data.inputUsdPerMillion,
        cachedInputUsdPerMillion: data.cachedInputUsdPerMillion,
        outputUsdPerMillion: data.outputUsdPerMillion,
        sourceUrl: data.sourceUrl,
        sourceNote: data.sourceNote,
        isActive: data.isActive ?? true,
        effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : undefined,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new HttpError(409, "AI pricing for provider and model already exists", "Conflict");
    }
    throw error;
  }
}

export async function updateAiPricing(id, data) {
  const existing = await prisma.aiModelPricing.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "AI pricing not found", "Not Found");
  const update = { ...data };
  if (update.provider) update.provider = String(update.provider).toLowerCase();
  if (update.effectiveAt) update.effectiveAt = new Date(update.effectiveAt);
  return prisma.aiModelPricing.update({ where: { id }, data: update });
}

async function getOrCreateCreditBalance(userWallet) {
  const existing = await prisma.creditBalance.findUnique({ where: { userWallet } });
  if (existing) return existing;
  return prisma.creditBalance.create({ data: { userWallet, balanceCredits: "0" } });
}

async function pricingForModel(provider, model) {
  const normalizedProvider = String(provider || "openai").toLowerCase();
  const normalizedModel = String(model || "").trim();
  const envPricing = matchPricingFromCatalog(parseEnvPricing(), normalizedProvider, normalizedModel);
  if (envPricing) return { ...envPricing, pricingSource: "env" };

  const dbPricing = await matchPricingFromDatabase(normalizedProvider, normalizedModel);
  if (dbPricing) {
    return {
      inputUsdPerMillion: dbPricing.inputUsdPerMillion,
      cachedInputUsdPerMillion: dbPricing.cachedInputUsdPerMillion,
      outputUsdPerMillion: dbPricing.outputUsdPerMillion,
      pricingSource: "database",
    };
  }

  const defaultPricing = matchPricingFromCatalog(DEFAULT_PRICING, normalizedProvider, normalizedModel);
  if (defaultPricing) return { ...defaultPricing, pricingSource: "default" };

  const fallback =
    normalizedProvider === "anthropic" ? DEFAULT_PRICING.anthropic["claude-sonnet-4-6"] : DEFAULT_PRICING.openai["gpt-4o-mini"];
  return { ...fallback, pricingSource: "fallback" };
}

function parseEnvPricing() {
  if (!env.aiPricingJson) return {};
  try {
    return mergePricingCatalog({}, JSON.parse(env.aiPricingJson));
  } catch {
    return {};
  }
}

async function matchPricingFromDatabase(provider, model) {
  const exact = await prisma.aiModelPricing.findFirst({
    where: { provider, model, isActive: true },
  });
  if (exact) return exact;

  const rows = await prisma.aiModelPricing.findMany({
    where: { provider, isActive: true },
    orderBy: { model: "desc" },
  });
  const lowerModel = model.toLowerCase();
  return rows.find((row) => lowerModel.includes(row.model.toLowerCase()));
}

function matchPricingFromCatalog(catalog, provider, model) {
  const providerPricing = catalog[provider] || {};
  const exact = providerPricing[model];
  if (exact) return exact;

  const lowerModel = model.toLowerCase();
  const match = Object.entries(providerPricing).find(([key]) => lowerModel.includes(key.toLowerCase()));
  return match?.[1] || null;
}

function pricingArrayToCatalog(items) {
  return items.reduce((catalog, item) => {
    catalog[item.provider] = catalog[item.provider] || {};
    catalog[item.provider][item.model] = {
      inputUsdPerMillion: Number(item.inputUsdPerMillion),
      cachedInputUsdPerMillion: Number(item.cachedInputUsdPerMillion ?? item.inputUsdPerMillion),
      outputUsdPerMillion: Number(item.outputUsdPerMillion),
    };
    return catalog;
  }, {});
}

function mergePricingCatalog(base, override) {
  const merged = { ...base };
  for (const [provider, providerPricing] of Object.entries(override || {})) {
    merged[provider] = { ...(merged[provider] || {}) };
    for (const [model, pricing] of Object.entries(providerPricing || {})) {
      merged[provider][model] = {
        inputUsdPerMillion: Number(pricing.inputUsdPerMillion ?? pricing.input),
        cachedInputUsdPerMillion: Number(
          pricing.cachedInputUsdPerMillion ?? pricing.cachedInput ?? pricing.inputUsdPerMillion ?? pricing.input
        ),
        outputUsdPerMillion: Number(pricing.outputUsdPerMillion ?? pricing.output),
      };
    }
  }
  return merged;
}

function markupForModel(model) {
  const lower = model.toLowerCase();
  if (lower.includes("haiku") || lower.includes("mini") || lower.includes("nano")) return 30000;
  if (lower.includes("opus") || lower.includes("pro")) return 20000;
  return env.defaultAiMarkupBps;
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(JSON.stringify(value || "").length / 4));
}

function toNumber(value) {
  return Number(value?.toString?.() ?? value ?? 0);
}

function roundMoney(value) {
  return Number(value.toFixed(8));
}

function roundCredits(value) {
  return Number(value.toFixed(6));
}
