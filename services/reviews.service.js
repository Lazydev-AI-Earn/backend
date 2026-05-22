import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";

export async function getReview(user, id) {
  const review = await prisma.reviewResult.findUnique({
    where: { id },
    include: {
      rental: { include: { bounty: true } },
      submission: { include: { bounty: true } },
    },
  });
  if (!review) throw new HttpError(404, "Review not found", "Not Found");

  const rentalWallet = review.rental?.userWallet;
  const submissionWallet = review.submission?.userWallet;
  const creatorWallet = review.rental?.bounty?.creatorWallet || review.submission?.bounty?.creatorWallet;

  if (
    isAdmin(user) ||
    isSameWallet(user, rentalWallet) ||
    isSameWallet(user, submissionWallet) ||
    isSameWallet(user, creatorWallet)
  ) {
    return review;
  }
  throw new HttpError(403, "Review access denied", "Forbidden");
}
