import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { agentConsumeSchema, agentRentalCreateSchema, idParamsSchema, walletParamsSchema } from "../validators/schemas.js";
import {
  cancelRental,
  consumeRentalAgent,
  createRental,
  getRentalForUser,
  listRentalConsumptions,
  listRentalsByWallet,
  startRental,
} from "../services/agent-rentals.service.js";

const router = Router();

const rentalCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const consumeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/agent-rentals",
  requireAuth,
  rentalCreateLimiter,
  validate(agentRentalCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createRental(req.user, req.body));
  })
);

router.get(
  "/agent-rentals/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getRentalForUser(req.user, req.params.id));
  })
);

router.get(
  "/users/:wallet/rentals",
  requireAuth,
  validate(walletParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await listRentalsByWallet(req.user, req.params.wallet));
  })
);

router.post(
  "/agent-rentals/:id/start",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await startRental(req.user, req.params.id));
  })
);

router.post(
  "/agent-rentals/:id/cancel",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await cancelRental(req.user, req.params.id));
  })
);

router.post(
  "/agent-rentals/:id/consume",
  requireAuth,
  consumeLimiter,
  validate(idParamsSchema, "params"),
  validate(agentConsumeSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await consumeRentalAgent(req.user, req.params.id, req.body));
  })
);

router.get(
  "/agent-rentals/:id/consumptions",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await listRentalConsumptions(req.user, req.params.id));
  })
);

export default router;
