import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { env } from "../config/env.js";

const router = Router();

router.get(
  "/blockchain/config",
  asyncHandler(async (req, res) => {
    res.json({
      chainId: env.celoChainId,
      rpcConfigured: Boolean(env.rpcUrl),
      bountyContractConfigured: Boolean(env.bountyContractAddress),
      agentRentalContractConfigured: Boolean(env.agentRentalContractAddress),
      treasuryConfigured: Boolean(env.treasuryAddress),
      mockPayments: env.mockPayments,
    });
  })
);

export default router;
