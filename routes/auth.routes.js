import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { validate } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";
import { authNonceQuerySchema, authVerifySchema } from "../validators/schemas.js";
import { createNonce, verifyWalletSignature } from "../services/auth.service.js";

const router = Router();

router.get(
  "/auth/nonce",
  validate(authNonceQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const nonce = await createNonce(req.query.wallet);
    res.json(nonce);
  })
);

router.post(
  "/auth/verify",
  validate(authVerifySchema),
  asyncHandler(async (req, res) => {
    const result = await verifyWalletSignature(req.body.walletAddress, req.body.signature);
    res.json(result);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

export default router;
