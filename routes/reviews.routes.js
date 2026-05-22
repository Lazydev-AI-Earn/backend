import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { idParamsSchema } from "../validators/schemas.js";
import { getReview } from "../services/reviews.service.js";

const router = Router();

router.get(
  "/reviews/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getReview(req.user, req.params.id));
  })
);

export default router;
