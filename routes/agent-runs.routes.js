import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { idParamsSchema } from "../validators/schemas.js";
import { getAgentRun } from "../services/agent-runs.service.js";

const router = Router();

router.get(
  "/agent-runs/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getAgentRun(req.user, req.params.id));
  })
);

export default router;
