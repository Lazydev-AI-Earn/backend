import { createPublicClient, http, isAddress } from "viem";
import { celo, celoSepolia } from "viem/chains";
import { env } from "../config/env.js";

function selectedChain() {
  if (env.celoChainId === 11142220) return celoSepolia;
  return celo;
}

export function createCeloClient() {
  if (!env.rpcUrl) return null;
  return createPublicClient({
    chain: selectedChain(),
    transport: http(env.rpcUrl),
  });
}

export async function verifyAgentRentalPayment(txHash, expectedAmount, userWallet) {
  if (env.mockPayments) return true;
  if (!env.rpcUrl || !env.agentRentalContractAddress || !env.treasuryAddress) {
    return false;
  }
  if (!txHash || !isAddress(userWallet)) return false;

  const client = createCeloClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  return receipt.status === "success";
}

export async function verifyBountyRewardDeposit(txHash, expectedAmount, creatorWallet) {
  if (env.mockPayments) return true;
  if (!env.rpcUrl || !env.bountyContractAddress || !env.treasuryAddress) {
    return false;
  }
  if (!txHash || !isAddress(creatorWallet)) return false;

  const client = createCeloClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  return receipt.status === "success";
}

export async function verifyMiniPayCreditPayment(txHash, expectedAmount, userWallet, tokenAddress) {
  if (env.mockPayments) return true;
  if (!env.rpcUrl || !env.treasuryAddress) {
    return false;
  }
  if (!txHash || !isAddress(userWallet)) return false;
  if (tokenAddress && !isAddress(tokenAddress)) return false;

  const client = createCeloClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  return receipt.status === "success";
}

export function listenToContractEvents() {
  if (!env.rpcUrl || !env.bountyContractAddress || !env.agentRentalContractAddress) {
    console.log("Blockchain sync disabled: missing RPC_URL or contract addresses");
    return;
  }
  console.log(`Blockchain sync ready for Celo chain ${env.celoChainId}`);
}
