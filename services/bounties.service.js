import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";
import { publicAgent } from "./agents.service.js";
import { toSkipTake } from "../validators/common.js";

export async function createBounty(user, data) {
  return prisma.bounty.create({
    data: {
      creatorWallet: user.walletAddress,
      title: data.title,
      description: data.description,
      category: data.category,
      requirements: data.requirements,
      submissionFormat: data.submissionFormat,
      rewardAmount: data.rewardAmount,
      rewardToken: data.rewardToken,
      deadline: data.deadline ? new Date(data.deadline) : null,
      metadataUri: data.metadataUri,
      status: "OPEN",
    },
  });
}

export async function listBounties(query) {
  const where = {};
  if (query.category) where.category = query.category;
  if (query.status) where.status = query.status;
  if (query.minReward || query.maxReward) {
    where.rewardAmount = {};
    if (query.minReward) where.rewardAmount.gte = query.minReward;
    if (query.maxReward) where.rewardAmount.lte = query.maxReward;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.bounty.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true, rentals: true } } },
    }),
    prisma.bounty.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getBountyDetail(id) {
  const bounty = await prisma.bounty.findUnique({
    where: { id },
    include: {
      _count: { select: { submissions: true, rentals: true } },
    },
  });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");

  const availableAgents = await prisma.agent.findMany({
    where: { isActive: true },
    orderBy: [{ isOfficial: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return {
    ...bounty,
    submissionsCount: bounty._count.submissions,
    rentalsCount: bounty._count.rentals,
    availableAgents: await Promise.all(availableAgents.map(publicAgent)),
  };
}

export async function updateBounty(user, id, data) {
  const bounty = await prisma.bounty.findUnique({ where: { id } });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");
  ensureBountyOwnerOrAdmin(user, bounty);

  return prisma.bounty.update({
    where: { id },
    data: {
      ...data,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    },
  });
}

export async function approveSubmission(user, bountyId, submissionId) {
  const { bounty, submission } = await getBountyAndSubmission(bountyId, submissionId);
  ensureBountyOwnerOrAdmin(user, bounty);

  return prisma.$transaction(async (tx) => {
    const updatedSubmission = await tx.submission.update({
      where: { id: submission.id },
      data: { status: "APPROVED", approvedAt: new Date(), rejectedAt: null },
    });
    await tx.bounty.update({ where: { id: bounty.id }, data: { status: "APPROVED" } });
    return updatedSubmission;
  });
}

export async function rejectSubmission(user, bountyId, submissionId) {
  const { bounty, submission } = await getBountyAndSubmission(bountyId, submissionId);
  ensureBountyOwnerOrAdmin(user, bounty);

  return prisma.submission.update({
    where: { id: submission.id },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });
}

export function ensureBountyOwnerOrAdmin(user, bounty) {
  if (isAdmin(user) || isSameWallet(user, bounty.creatorWallet)) return;
  throw new HttpError(403, "Only bounty creator or admin can perform this action", "Forbidden");
}

async function getBountyAndSubmission(bountyId, submissionId) {
  const bounty = await prisma.bounty.findUnique({ where: { id: bountyId } });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.bountyId !== bountyId) {
    throw new HttpError(404, "Submission not found for bounty", "Not Found");
  }
  return { bounty, submission };
}
