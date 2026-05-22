import { prisma } from "../services/prisma.js";
import {
  analyzeBounty,
  buildSubmission,
  reviewSubmission,
  reviseSubmission,
  solveBounty,
} from "../services/ai.service.js";
import {
  enqueueBuildSubmission,
  enqueueReview,
  enqueueRevise,
  enqueueSolve,
  enqueueSubmit,
} from "../queues/index.js";
import { createSubmission } from "../services/submissions.service.js";
import { sanitizeJson, sanitizeText } from "../utils/sanitize.js";
import { requiresExternalPosting, requiresWalletAction } from "../utils/risk.js";
import { listenToContractEvents } from "../services/blockchain.service.js";
import { loadAgentSkill } from "../services/agent-skills.service.js";

const MAX_REVISION_ATTEMPTS = 3;

async function getRental(rentalId) {
  const rental = await prisma.agentRental.findUnique({
    where: { id: rentalId },
    include: { bounty: true, agent: true, runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!rental) throw new Error(`Rental ${rentalId} not found`);
  if (["CANCELLED", "SUBMITTED"].includes(rental.status)) {
    throw new Error(`Rental ${rentalId} is already ${rental.status}`);
  }
  return rental;
}

async function runStep(rentalId, step, rentalStatus, handler) {
  await prisma.agentRental.update({ where: { id: rentalId }, data: { status: rentalStatus } });
  const run = await prisma.agentRun.create({
    data: {
      rentalId,
      step,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const output = await handler(run);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        outputJson: sanitizeJson(output),
        score: typeof output?.score === "number" ? output.score : null,
        finishedAt: new Date(),
      },
    });
    return output;
  } catch (error) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: error.message,
        finishedAt: new Date(),
      },
    });
    await prisma.agentRental.update({
      where: { id: rentalId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

function latestRun(rental, step) {
  return [...rental.runs].reverse().find((run) => run.step === step && run.status === "COMPLETED");
}

function solverSlugForCategory(category) {
  if (category === "CONTENT") return "content-solver";
  if (category === "TRANSLATION") return "translation-solver";
  if (category === "QA_TESTING") return "qa-report-solver";
  if (category === "WEB3_ANALYSIS" || category === "RESEARCH") return "research-solver";
  return "research-solver";
}

export async function processAnalyze({ rentalId }) {
  const rental = await getRental(rentalId);
  const analyzerAgent = await agentForStep(rental, "task-analyzer", "ANALYZER");
  const analyzerSkill = await skillForAgent(analyzerAgent);
  const output = await runStep(rentalId, "ANALYZE", "ANALYZING", () =>
    analyzeBounty({
      bounty: rental.bounty,
      agent: analyzerAgent,
      agentSkill: analyzerSkill.content,
      mode: rental.mode,
    })
  );

  if (rental.mode === "ANALYZE_ONLY") {
    await prisma.agentRental.update({
      where: { id: rentalId },
      data: { status: "READY_TO_SUBMIT", finalOutput: sanitizeJson(output) },
    });
    return output;
  }

  await enqueueSolve(rentalId);
  return output;
}

export async function processSolve({ rentalId }) {
  const rental = await getRental(rentalId);
  const solverSlug = solverSlugForCategory(rental.bounty.category);
  const solverAgent = await agentForStep(rental, solverSlug, "SOLVER");
  const solverSkill = await skillForAgent(solverAgent);

  const output = await runStep(rentalId, "SOLVE", "SOLVING", () =>
    solveBounty({
      bounty: rental.bounty,
      rental,
      selectedAgent: solverAgent,
      agent: solverAgent,
      agentSkill: solverSkill.content,
      analysis: latestRun(rental, "ANALYZE")?.outputJson,
    })
  );

  await enqueueBuildSubmission(rentalId);
  return output;
}

export async function processBuildSubmission({ rentalId }) {
  const rental = await getRental(rentalId);
  const solverOutput = latestRun(rental, "SOLVE")?.outputJson;
  const builderAgent = await agentForStep(rental, "submission-builder", "BUILDER");
  const builderSkill = await skillForAgent(builderAgent);
  const output = await runStep(rentalId, "BUILD_SUBMISSION", "BUILDING_SUBMISSION", () =>
    buildSubmission({
      bounty: rental.bounty,
      rental,
      solverOutput,
      agent: builderAgent,
      agentSkill: builderSkill.content,
    })
  );

  await prisma.agentRental.update({
    where: { id: rentalId },
    data: { finalOutput: sanitizeJson(output) },
  });

  if (rental.mode === "SOLVE_DRAFT") {
    await prisma.agentRental.update({ where: { id: rentalId }, data: { status: "READY_TO_SUBMIT" } });
    return output;
  }

  await enqueueReview(rentalId);
  return output;
}

export async function processReview({ rentalId }) {
  const rental = await getRental(rentalId);
  const reviewAgent = await agentForStep(rental, "auto-review", "REVIEWER");
  const reviewSkill = await skillForAgent(reviewAgent);
  const output = await runStep(rentalId, "REVIEW", "REVIEWING", () =>
    reviewSubmission({
      bounty: rental.bounty,
      rental,
      finalOutput: rental.finalOutput,
      agent: reviewAgent,
      agentSkill: reviewSkill.content,
      analysis: latestRun(rental, "ANALYZE")?.outputJson,
    })
  );

  const status = output.score >= 75 ? "PASSED" : output.score >= 60 ? "NEEDS_REVISION" : "FAILED";
  await prisma.reviewResult.create({
    data: {
      rentalId,
      score: output.score,
      status,
      missingRequirements: output.missingRequirements || [],
      qualityIssues: output.qualityIssues || [],
      recommendations: output.recommendations || [],
      readyToSubmit: Boolean(output.readyToSubmit),
    },
  });

  await prisma.agentRental.update({
    where: { id: rentalId },
    data: { reviewScore: output.score },
  });

  const analysis = latestRun(rental, "ANALYZE")?.outputJson;
  if (analysis?.riskLevel === "high") {
    await prisma.agentRental.update({ where: { id: rentalId }, data: { status: "NEEDS_MANUAL_REVIEW" } });
    return output;
  }

  if (output.score >= 75) {
    if (rental.autoSubmitEnabled || rental.mode === "AUTO_SUBMIT") {
      await enqueueSubmit(rentalId);
    } else {
      await prisma.agentRental.update({ where: { id: rentalId }, data: { status: "READY_TO_SUBMIT" } });
    }
    return output;
  }

  if (output.score >= 60 && rental.revisionAttempts < MAX_REVISION_ATTEMPTS) {
    await enqueueRevise(rentalId);
    return output;
  }

  await prisma.agentRental.update({ where: { id: rentalId }, data: { status: "NEEDS_MANUAL_REVIEW" } });
  return output;
}

export async function processRevise({ rentalId }) {
  const rental = await getRental(rentalId);
  const revisionAgent = await agentForStep(rental, "revision-agent", "REVISION");
  const revisionSkill = await skillForAgent(revisionAgent);
  await prisma.agentRental.update({
    where: { id: rentalId },
    data: { revisionAttempts: { increment: 1 }, status: "REVISING" },
  });

  const output = await runStep(rentalId, "REVISE", "REVISING", () =>
    reviseSubmission({
      bounty: rental.bounty,
      rental,
      currentOutput: rental.finalOutput,
      review: latestRun(rental, "REVIEW")?.outputJson,
      agent: revisionAgent,
      agentSkill: revisionSkill.content,
    })
  );

  await prisma.agentRental.update({
    where: { id: rentalId },
    data: { finalOutput: sanitizeJson(output) },
  });
  await enqueueReview(rentalId);
  return output;
}

export async function processSubmit({ rentalId }) {
  const rental = await getRental(rentalId);
  const submitAgent = await agentForStep(rental, "auto-submit", "SUBMITTER");
  const submitSkill = await skillForAgent(submitAgent);
  const safetyError = autoSubmitSafetyError(rental);
  if (safetyError) {
    await prisma.agentRental.update({
      where: { id: rentalId },
      data: { status: "NEEDS_MANUAL_REVIEW" },
    });
    throw new Error(safetyError);
  }

  const output = rental.finalOutput;
  const content = sanitizeText(
    [output.title, output.content, output.proofOfWorkSummary].filter(Boolean).join("\n\n")
  );

  await runStep(rentalId, "SUBMIT", "READY_TO_SUBMIT", async () => ({
    contentLength: content.length,
    autoSubmitted: true,
    skillSource: submitSkill.source,
    agentSlug: submitAgent?.slug || "auto-submit",
  }));

  return createSubmission(
    { walletAddress: rental.userWallet, role: "USER" },
    {
      bountyId: rental.bountyId,
      rentalId: rental.id,
      content,
    },
    { autoSubmitted: true, reviewScore: rental.reviewScore }
  );
}

async function agentBySlug(slug) {
  return prisma.agent.findUnique({ where: { slug } });
}

async function agentForStep(rental, fallbackSlug, matchingAgentType) {
  if (rental.agent?.agentType === matchingAgentType) {
    return rental.agent;
  }

  const fallbackAgent = await agentBySlug(fallbackSlug);
  return fallbackAgent || rental.agent;
}

async function skillForAgent(agent) {
  return loadAgentSkill(agent.slug, agent.systemPrompt || "");
}

export async function processBlockchainSync() {
  listenToContractEvents();
  return { synced: true };
}

function autoSubmitSafetyError(rental) {
  const output = rental.finalOutput;
  const analysis = latestRun(rental, "ANALYZE")?.outputJson;
  const content = [output?.title, output?.content, output?.proofOfWorkSummary].filter(Boolean).join("\n");

  if (!rental.autoSubmitEnabled && rental.mode !== "AUTO_SUBMIT") return "Auto submit is disabled";
  if ((rental.reviewScore || 0) < 75) return "Review score is below auto-submit threshold";
  if (rental.bounty.status !== "OPEN") return "Bounty is not open";
  if (!output) return "Final output is missing";
  if (analysis?.riskLevel === "high") return "High-risk task requires manual review";
  if (analysis?.autoSubmitAllowed === false) return "Analyzer did not allow auto-submit";
  if (content.trim().length < 80) return "Final output is too short";
  if (requiresExternalPosting(content)) return "External posting requires manual review";
  if (requiresWalletAction(content)) return "Wallet action requires manual review";
  if (rental.bounty.category === "DEVELOPMENT" && !/test/i.test(content)) {
    return "Development bounty needs test result evidence";
  }
  return null;
}
