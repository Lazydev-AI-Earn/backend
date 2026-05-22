import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { idParamsSchema, submissionCreateSchema } from "../validators/schemas.js";
import {
  approveSubmissionById,
  createSubmission,
  getSubmission,
  listBountySubmissions,
  rejectSubmissionById,
} from "../services/submissions.service.js";

const router = Router();

router.post(
  "/submissions",
  requireAuth,
  validate(submissionCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createSubmission(req.user, req.body));
  })
);

router.get(
  "/submissions/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getSubmission(req.user, req.params.id));
  })
);

router.get(
  "/bounties/:id/submissions",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await listBountySubmissions(req.user, req.params.id));
  })
);

router.post(
  "/submissions/:id/approve",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await approveSubmissionById(req.user, req.params.id));
  })
);

router.post(
  "/submissions/:id/reject",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await rejectSubmissionById(req.user, req.params.id));
  })
);

export default router;
