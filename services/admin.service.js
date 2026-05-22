import { prisma } from "./prisma.js";
import { toSkipTake } from "../validators/common.js";
import { HttpError } from "../middlewares/errors.js";
import { disableAgent } from "./agents.service.js";
import { markRentalFailed, retryRental } from "./agent-rentals.service.js";

export async function listAdmin(modelName, query) {
  const { skip, take } = toSkipTake(query);
  const model = prisma[modelName];
  if (!model) throw new HttpError(404, "Admin resource not found", "Not Found");
  const [items, total] = await Promise.all([
    model.findMany({ skip, take, orderBy: { createdAt: "desc" } }),
    model.count(),
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function pauseBounty(id) {
  return prisma.bounty.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function disableAgentById(id) {
  return disableAgent(id);
}

export async function markFailed(id) {
  return markRentalFailed(id);
}

export async function retry(id) {
  return retryRental(id);
}

export async function forceReviewSubmission(id) {
  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) throw new HttpError(404, "Submission not found", "Not Found");
  return prisma.submission.update({
    where: { id },
    data: { status: "REVISION_NEEDED" },
  });
}
