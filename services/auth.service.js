import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { verifyMessage } from "viem";
import { prisma } from "./prisma.js";
import { requireJwtSecret, env } from "../config/env.js";
import { HttpError } from "../middlewares/errors.js";
import { normalizeWallet } from "../utils/wallet.js";

const NONCE_TTL_MINUTES = 10;

function buildAuthMessage(walletAddress, nonce, expiresAt) {
  return [
    "Sign this message to authenticate with wearelazydev.",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join("\n");
}

export async function createNonce(walletAddress) {
  const wallet = normalizeWallet(walletAddress);
  if (!wallet) {
    throw new HttpError(400, "Invalid wallet address", "Bad Request");
  }

  const nonce = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60 * 1000);
  const message = buildAuthMessage(wallet, nonce, expiresAt);

  await prisma.nonce.create({
    data: {
      walletAddress: wallet,
      nonce,
      message,
      expiresAt,
    },
  });

  return { walletAddress: wallet, nonce, message, expiresAt };
}

export async function verifyWalletSignature(walletAddress, signature) {
  const wallet = normalizeWallet(walletAddress);
  if (!wallet) {
    throw new HttpError(400, "Invalid wallet address", "Bad Request");
  }

  const nonce = await prisma.nonce.findFirst({
    where: {
      walletAddress: wallet,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!nonce) {
    throw new HttpError(401, "No valid nonce found for wallet", "Unauthorized");
  }

  const valid = await verifyMessage({
    address: wallet,
    message: nonce.message,
    signature,
  });

  if (!valid) {
    throw new HttpError(401, "Invalid wallet signature", "Unauthorized");
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.nonce.update({ where: { id: nonce.id }, data: { used: true } });
    return tx.user.upsert({
      where: { walletAddress: wallet },
      update: {},
      create: { walletAddress: wallet, role: "USER" },
    });
  });

  const token = jwt.sign(
    { sub: user.id, walletAddress: user.walletAddress, role: user.role },
    requireJwtSecret(),
    { expiresIn: env.jwtExpiresIn }
  );

  return { token, user };
}
