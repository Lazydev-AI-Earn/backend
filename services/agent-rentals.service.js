import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";
import { enqueueAnalyze } from "../queues/index.js";
import { env } from "../config/env.js";
import { verifyAgentRentalPayment } from "./blockchain.service.js";
import { publicAgent } from "./agents.service.js";
import { consumeAgentWithUsage, resolveModel, resolveProvider } from "./ai.service.js";
import { loadAgentSkill } from "./agent-skills.service.js";
import {
  calculateConsumptionCharge,
  ensureMinimumCredits,
  estimateAiUsage,
  settleConsumptionCharge,
} from "./billing.service.js";
import { sanitizeJson } from "../utils/sanitize.js";

export async function createRental(user, data) {
  const bounty = await prisma.bounty.findUnique({ where: { id: data.bountyId } });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");
  if (bounty.status !== "OPEN") {
    throw new HttpError(400, "Bounty is not open", "Bad Request");
  }

  const agent = await prisma.agent.findUnique({ where: { id: data.agentId } });
  if (!agent || !agent.isActive) {
    throw new HttpError(404, "Active agent not found", "Not Found");
  }

  let paymentStatus = "PENDING";
  let rentalStatus = data.paymentTxHash ? "PAYMENT_PENDING" : "CREATED";

  if (env.mockPayments) {
    paymentStatus = "CONFIRMED";
    rentalStatus = "PAID";
  } else if (data.paymentTxHash) {
    const paid = await verifyAgentRentalPayment(data.paymentTxHash, agent.price, user.walletAddress);
    paymentStatus = paid ? "CONFIRMED" : "FAILED";
    rentalStatus = paid ? "PAID" : "PAYMENT_PENDING";
  }

  const rental = await prisma.$transaction(async (tx) => {
    const createdRental = await tx.agentRental.create({
      data: {
        bountyId: bounty.id,
        agentId: agent.id,
        userWallet: user.walletAddress,
        mode: data.mode,
        autoSubmitEnabled: data.autoSubmitEnabled || data.mode === "AUTO_SUBMIT",
        paymentTxHash: data.paymentTxHash,
        status: rentalStatus,
      },
      include: { bounty: true, agent: true },
    });

    await tx.payment.create({
      data: {
        userWallet: user.walletAddress,
        type: "AGENT_RENTAL",
        amount: agent.price || "0",
        tokenAddress: agent.paymentToken,
        txHash: data.paymentTxHash,
        status: paymentStatus,
        relatedBountyId: bounty.id,
        relatedRentalId: createdRental.id,
      },
    });

    return createdRental;
  });

  if (rental.status === "PAID") {
    await enqueueAnalyze(rental.id);
  }

  return sanitizeRental(rental);
}

export async function getRentalForUser(user, id) {
  const rental = await prisma.agentRental.findUnique({
    where: { id },
    include: {
      bounty: true,
      agent: true,
      runs: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" } },
      submissions: { orderBy: { createdAt: "desc" } },
      payments: true,
    },
  });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  ensureRentalOwnerOrAdmin(user, rental);
  return sanitizeRental(rental);
}

export async function listRentalsByWallet(user, walletAddress) {
  if (!isAdmin(user) && !isSameWallet(user, walletAddress)) {
    throw new HttpError(403, "Rental access denied", "Forbidden");
  }
  const rentals = await prisma.agentRental.findMany({
    where: { userWallet: walletAddress.toLowerCase() },
    orderBy: { createdAt: "desc" },
    include: { bounty: true, agent: true, runs: true, submissions: true },
  });
  return Promise.all(rentals.map(sanitizeRental));
}

export async function startRental(user, id) {
  const rental = await prisma.agentRental.findUnique({ where: { id } });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  ensureRentalOwnerOrAdmin(user, rental);
  if (rental.status !== "PAID" && rental.status !== "READY_TO_SUBMIT") {
    throw new HttpError(400, "Only paid rentals can be started", "Bad Request");
  }
  await enqueueAnalyze(rental.id);
  return rental;
}

export async function cancelRental(user, id) {
  const rental = await prisma.agentRental.findUnique({ where: { id } });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  ensureRentalOwnerOrAdmin(user, rental);
  if (["SUBMITTED", "CANCELLED"].includes(rental.status)) {
    throw new HttpError(400, "Rental cannot be cancelled", "Bad Request");
  }
  return prisma.agentRental.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function consumeRentalAgent(user, id, data) {
  const rental = await prisma.agentRental.findUnique({
    where: { id },
    include: { bounty: true, agent: true },
  });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  ensureRentalOwnerOrAdmin(user, rental);
  ensureConsumableRental(rental);

  if (!rental.agent?.isActive) {
    throw new HttpError(404, "Active agent not found", "Not Found");
  }

  await ensureMinimumCredits(user.walletAddress);

  const agentSkill = await loadAgentSkill(rental.agent.slug, rental.agent.systemPrompt);
  const inputJson = sanitizeJson({
    userInput: data.input,
    context: data.context || {},
    provider: resolveProvider(rental.agent),
    model: resolveModel(rental.agent),
  });

  const run = await prisma.agentRun.create({
    data: {
      rentalId: rental.id,
      step: "CONSUME",
      status: "RUNNING",
      inputJson,
      startedAt: new Date(),
    },
  });

  try {
    const aiResult = await consumeAgentWithUsage({
      bounty: rental.bounty,
      rental,
      agent: rental.agent,
      agentSkill: agentSkill.content,
      userInput: data.input,
      context: data.context || {},
    });
    const output = aiResult.output;
    const usage = aiResult.usage || estimateAiUsage(inputJson, output);
    const charge = await calculateConsumptionCharge({ agent: rental.agent, ...usage });
    const billing = await settleConsumptionCharge({
      userWallet: user.walletAddress,
      rental,
      agent: rental.agent,
      run,
      charge,
    });

    const completedRun = await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        outputJson: sanitizeJson({ output, billing: publicBilling(charge, billing.consumption) }),
        finishedAt: new Date(),
      },
    });

    return {
      runId: completedRun.id,
      rentalId: rental.id,
      agentId: rental.agent.id,
      status: completedRun.status,
      output,
      billing: publicBilling(charge, billing.consumption),
    };
  } catch (error) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: error.message,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function listRentalConsumptions(user, id) {
  const rental = await prisma.agentRental.findUnique({ where: { id } });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  ensureRentalOwnerOrAdmin(user, rental);
  return prisma.agentRun.findMany({
    where: { rentalId: id, step: "CONSUME" },
    orderBy: { createdAt: "desc" },
  });
}

export async function retryRental(id) {
  const rental = await prisma.agentRental.findUnique({ where: { id } });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  await prisma.agentRental.update({
    where: { id },
    data: { status: "PAID", revisionAttempts: 0, reviewScore: null },
  });
  await enqueueAnalyze(id);
  return prisma.agentRental.findUnique({ where: { id } });
}

export async function markRentalFailed(id) {
  const rental = await prisma.agentRental.findUnique({ where: { id } });
  if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
  return prisma.agentRental.update({ where: { id }, data: { status: "FAILED" } });
}

export function ensureRentalOwnerOrAdmin(user, rental) {
  if (isAdmin(user) || isSameWallet(user, rental.userWallet)) return;
  throw new HttpError(403, "Rental access denied", "Forbidden");
}

async function sanitizeRental(rental) {
  if (!rental?.agent) return rental;
  return {
    ...rental,
    agent: await publicAgent(rental.agent),
  };
}

function ensureConsumableRental(rental) {
  const allowedStatuses = new Set([
    "PAID",
    "ANALYZING",
    "SOLVING",
    "BUILDING_SUBMISSION",
    "REVIEWING",
    "REVISING",
    "READY_TO_SUBMIT",
    "NEEDS_MANUAL_REVIEW",
  ]);
  if (!allowedStatuses.has(rental.status)) {
    throw new HttpError(400, `Rental status ${rental.status} cannot consume agent API`, "Bad Request");
  }
}

function publicBilling(charge, consumption) {
  return {
    consumptionId: consumption.id,
    provider: charge.provider,
    model: charge.model,
    inputTokens: charge.inputTokens,
    cachedInputTokens: charge.cachedInputTokens,
    outputTokens: charge.outputTokens,
    usageSource: charge.usageSource,
    pricingSource: charge.pricingSource,
    inputUsdPerMillion: charge.inputUsdPerMillion,
    cachedInputUsdPerMillion: charge.cachedInputUsdPerMillion,
    outputUsdPerMillion: charge.outputUsdPerMillion,
    aiCostUsd: charge.aiCostUsd,
    aiCostCredits: charge.aiCostCredits,
    chargedCredits: charge.chargedCredits,
    creatorPayoutCredits: charge.creatorPayoutCredits,
    platformFeeCredits: charge.platformFeeCredits,
  };
}
