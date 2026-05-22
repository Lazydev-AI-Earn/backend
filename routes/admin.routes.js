import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  agentCreateSchema,
  agentUpdateSchema,
  aiPricingCreateSchema,
  aiPricingQuerySchema,
  aiPricingUpdateSchema,
  idParamsSchema,
} from "../validators/schemas.js";
import { paginationQuery } from "../validators/common.js";
import { createAgent, updateAgent } from "../services/agents.service.js";
import { createAiPricing, listAiPricing, updateAiPricing } from "../services/billing.service.js";
import {
  disableAgentById,
  forceReviewSubmission,
  listAdmin,
  markFailed,
  pauseBounty,
  retry,
} from "../services/admin.service.js";

const router = Router();

router.use("/admin", requireAuth, requireRole("ADMIN"));

router.get(
  "/admin/bounties",
  validate(paginationQuery(), "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAdmin("bounty", req.query));
  })
);

router.get(
  "/admin/rentals",
  validate(paginationQuery(), "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAdmin("agentRental", req.query));
  })
);

router.get(
  "/admin/agent-runs",
  validate(paginationQuery(), "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAdmin("agentRun", req.query));
  })
);

router.get(
  "/admin/submissions",
  validate(paginationQuery(), "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAdmin("submission", req.query));
  })
);

router.get(
  "/admin/payments",
  validate(paginationQuery(), "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAdmin("payment", req.query));
  })
);

router.get(
  "/admin/ai-pricing",
  validate(aiPricingQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    res.json(await listAiPricing(req.query));
  })
);

router.post(
  "/admin/ai-pricing",
  validate(aiPricingCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAiPricing(req.body));
  })
);

router.patch(
  "/admin/ai-pricing/:id",
  validate(idParamsSchema, "params"),
  validate(aiPricingUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateAiPricing(req.params.id, req.body));
  })
);

router.post(
  "/admin/agents",
  validate(agentCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAgent(req.body));
  })
);

router.patch(
  "/admin/agents/:id",
  validate(idParamsSchema, "params"),
  validate(agentUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateAgent(req.params.id, req.body));
  })
);

router.post(
  "/admin/agents/:id/disable",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await disableAgentById(req.params.id));
  })
);

router.post(
  "/admin/bounties/:id/pause",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await pauseBounty(req.params.id));
  })
);

router.post(
  "/admin/rentals/:id/mark-failed",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await markFailed(req.params.id));
  })
);

router.post(
  "/admin/rentals/:id/retry",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await retry(req.params.id));
  })
);

router.post(
  "/admin/submissions/:id/force-review",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await forceReviewSubmission(req.params.id));
  })
);

export default router;
