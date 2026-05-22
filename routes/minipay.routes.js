import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { creditPurchaseSchema } from "../validators/schemas.js";
import { createMiniPayCreditPurchaseIntent, getMiniPayConfig } from "../services/minipay.service.js";

const router = Router();

router.get(
  "/minipay/config",
  asyncHandler(async (req, res) => {
    res.json(getMiniPayConfig());
  })
);

router.post(
  "/minipay/credit-purchases",
  requireAuth,
  validate(creditPurchaseSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createMiniPayCreditPurchaseIntent(req.user, req.body));
  })
);

export default router;
