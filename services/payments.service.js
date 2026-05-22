import { prisma } from "./prisma.js";
import { isAdmin } from "../middlewares/auth.js";

export async function listPayments(user) {
  return prisma.payment.findMany({
    where: isAdmin(user) ? {} : { userWallet: user.walletAddress },
    orderBy: { createdAt: "desc" },
  });
}
