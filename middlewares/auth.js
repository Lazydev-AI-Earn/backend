import jwt from "jsonwebtoken";
import { prisma } from "../services/prisma.js";
import { requireJwtSecret } from "../config/env.js";
import { HttpError } from "./errors.js";
import { normalizeWallet } from "../utils/wallet.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      throw new HttpError(401, "Missing bearer token", "Unauthorized");
    }

    const payload = jwt.verify(token, requireJwtSecret());
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new HttpError(401, "Authenticated user not found", "Unauthorized");
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, "Invalid or expired token", "Unauthorized"));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, "Authentication required", "Unauthorized"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "Insufficient role", "Forbidden"));
    }
    return next();
  };
}

export function isAdmin(user) {
  return user?.role === "ADMIN";
}

export function isSameWallet(user, walletAddress) {
  return normalizeWallet(user?.walletAddress) === normalizeWallet(walletAddress);
}

export function requireSameWalletParam(paramName = "wallet") {
  return (req, res, next) => {
    if (isAdmin(req.user) || isSameWallet(req.user, req.params[paramName])) {
      return next();
    }
    return next(new HttpError(403, "Wallet access denied", "Forbidden"));
  };
}
