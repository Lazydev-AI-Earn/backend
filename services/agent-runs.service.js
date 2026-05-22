import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";

export async function getAgentRun(user, id) {
  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: { rental: { include: { bounty: true } } },
  });
  if (!run) throw new HttpError(404, "Agent run not found", "Not Found");

  if (
    isAdmin(user) ||
    isSameWallet(user, run.rental.userWallet) ||
    isSameWallet(user, run.rental.bounty.creatorWallet)
  ) {
    return run;
  }
  throw new HttpError(403, "Agent run access denied", "Forbidden");
}
