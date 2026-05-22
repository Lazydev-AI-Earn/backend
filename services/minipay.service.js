import { env } from "../config/env.js";
import { createMiniPayCreditPurchase } from "./billing.service.js";

const DEFAULT_TOKENS = [
  { symbol: "USDC", decimals: 6, address: "" },
  { symbol: "USDT", decimals: 6, address: "" },
  { symbol: "USDm", decimals: 18, address: "" },
];

export function getMiniPayConfig() {
  return {
    appId: env.minipayAppId || null,
    chainId: env.celoChainId,
    treasuryAddress: env.treasuryAddress || null,
    supportedStablecoins: supportedTokens(),
    paymentLabels: {
      networkFee: "Network fee",
      deposit: "Deposit",
      withdraw: "Withdraw",
      stablecoin: "Stablecoin",
    },
    creditUsdValue: env.creditUsdValue,
    notes: [
      "MiniPay flows should use stablecoin wording.",
      "Do not require CELO from users.",
      "Wallet or frontend should handle fee abstraction.",
    ],
  };
}

export async function createMiniPayCreditPurchaseIntent(user, data) {
  const token = tokenBySymbol(data.tokenSymbol);
  return createMiniPayCreditPurchase(user, {
    ...data,
    tokenAddress: data.tokenAddress || token?.address || undefined,
  });
}

function supportedTokens() {
  if (!env.minipaySupportedTokensJson) return DEFAULT_TOKENS;
  try {
    const parsed = JSON.parse(env.minipaySupportedTokensJson);
    if (!Array.isArray(parsed)) return DEFAULT_TOKENS;
    return parsed.filter((token) => ["USDC", "USDT", "USDm"].includes(token.symbol));
  } catch {
    return DEFAULT_TOKENS;
  }
}

function tokenBySymbol(symbol) {
  return supportedTokens().find((token) => token.symbol === symbol);
}
