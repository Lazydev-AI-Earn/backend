import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { aiPricingQuerySchema, idParamsSchema, walletParamsSchema } from "../validators/schemas.js";
import {
  getBillingAccount,
  getBusinessModel,
  listAiPricing,
  listConsumptions,
  listCreatorPayouts,
} from "../services/billing.service.js";

const router = Router();

router.get(
  "/billing/business-model",
  asyncHandler(async (req, res) => {
    res.json(getBusinessModel());
  })
);

router.get(
  "/billing/ai-pricing",
  validate(aiPricingQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAiPricing({ ...req.query, activeOnly: req.query.activeOnly ?? "true" }));
  })
);

router.get(
  "/billing/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getBillingAccount(req.user));
  })
);

router.get(
  "/billing/consumptions",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listConsumptions(req.user, req.query));
  })
);

router.get(
  "/users/:wallet/creator-payouts",
  requireAuth,
  validate(walletParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await listCreatorPayouts(req.user, req.params.wallet));
  })
);

router.get(
  "/billing/consumptions/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const items = await listConsumptions(req.user);
    const item = items.find((consumption) => consumption.id === req.params.id);
    res.json(item || null);
  })
);

export default router;
