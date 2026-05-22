import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { listPayments } from "../services/payments.service.js";

const router = Router();

router.get(
  "/payments",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listPayments(req.user));
  })
);

export default router;
