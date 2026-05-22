import { isAddress } from "viem";

export function normalizeWallet(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) {
    return null;
  }
  return walletAddress.toLowerCase();
}

export function assertWallet(walletAddress) {
  const normalized = normalizeWallet(walletAddress);
  if (!normalized) {
    throw new Error("Invalid wallet address");
  }
  return normalized;
}
