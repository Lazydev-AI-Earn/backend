import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";
import { ensureBountyOwnerOrAdmin } from "./bounties.service.js";
import { sanitizeText } from "../utils/sanitize.js";

function contentHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function createSubmission(user, data, options = {}) {
  const bounty = await prisma.bounty.findUnique({ where: { id: data.bountyId } });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");
  if (bounty.status !== "OPEN") {
    throw new HttpError(400, "Bounty is not open", "Bad Request");
  }

  let rental = null;
  if (data.rentalId) {
    rental = await prisma.agentRental.findUnique({ where: { id: data.rentalId } });
    if (!rental) throw new HttpError(404, "Rental not found", "Not Found");
    if (!isSameWallet(user, rental.userWallet) && !isAdmin(user)) {
      throw new HttpError(403, "Rental access denied", "Forbidden");
    }
    if (rental.bountyId !== data.bountyId) {
      throw new HttpError(400, "Rental does not belong to bounty", "Bad Request");
    }
  }

  const cleanContent = sanitizeText(data.content);
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        bountyId: data.bountyId,
        rentalId: data.rentalId,
        userWallet: user.walletAddress,
        content: cleanContent,
        proofUrl: data.proofUrl,
        contentHash: contentHash(cleanContent),
        status: "SUBMITTED",
        autoSubmitted: options.autoSubmitted || false,
        reviewScore: options.reviewScore,
        submittedAt: new Date(),
      },
    });

    if (rental) {
      await tx.agentRental.update({
        where: { id: rental.id },
        data: { status: "SUBMITTED" },
      });
    }

    await tx.bounty.update({
      where: { id: data.bountyId },
      data: { status: "SUBMITTED" },
    });

    return submission;
  });
}

export async function getSubmission(user, id) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { bounty: true, rental: true, reviews: true },
  });
  if (!submission) throw new HttpError(404, "Submission not found", "Not Found");

  if (
    isAdmin(user) ||
    isSameWallet(user, submission.userWallet) ||
    isSameWallet(user, submission.bounty.creatorWallet)
  ) {
    return submission;
  }
  throw new HttpError(403, "Submission access denied", "Forbidden");
}

export async function listBountySubmissions(user, bountyId) {
  const bounty = await prisma.bounty.findUnique({ where: { id: bountyId } });
  if (!bounty) throw new HttpError(404, "Bounty not found", "Not Found");

  const where = { bountyId };
  if (!isAdmin(user) && !isSameWallet(user, bounty.creatorWallet)) {
    where.userWallet = user.walletAddress;
  }

  return prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { reviews: true },
  });
}

export async function approveSubmissionById(user, id) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { bounty: true },
  });
  if (!submission) throw new HttpError(404, "Submission not found", "Not Found");
  ensureBountyOwnerOrAdmin(user, submission.bounty);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.submission.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date(), rejectedAt: null },
    });
    await tx.bounty.update({ where: { id: submission.bountyId }, data: { status: "APPROVED" } });
    return updated;
  });
}

export async function rejectSubmissionById(user, id) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { bounty: true },
  });
  if (!submission) throw new HttpError(404, "Submission not found", "Not Found");
  ensureBountyOwnerOrAdmin(user, submission.bounty);

  return prisma.submission.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });
}
