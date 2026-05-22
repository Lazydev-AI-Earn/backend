import { Router } from "express";
import { asyncHandler } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  bountyCreateSchema,
  bountyListQuerySchema,
  bountySubmissionParamsSchema,
  bountyUpdateSchema,
  idParamsSchema,
} from "../validators/schemas.js";
import {
  approveSubmission,
  createBounty,
  getBountyDetail,
  listBounties,
  rejectSubmission,
  updateBounty,
} from "../services/bounties.service.js";

const router = Router();

router.post(
  "/bounties",
  requireAuth,
  validate(bountyCreateSchema),
  asyncHandler(async (req, res) => {
    const bounty = await createBounty(req.user, req.body);
    res.status(201).json(bounty);
  })
);

router.get(
  "/bounties",
  validate(bountyListQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    res.json(await listBounties(req.query));
  })
);

router.get(
  "/bounties/:id",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getBountyDetail(req.params.id));
  })
);

router.patch(
  "/bounties/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  validate(bountyUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateBounty(req.user, req.params.id, req.body));
  })
);

router.post(
  "/bounties/:id/approve-submission/:submissionId",
  requireAuth,
  validate(bountySubmissionParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await approveSubmission(req.user, req.params.id, req.params.submissionId));
  })
);

router.post(
  "/bounties/:id/reject-submission/:submissionId",
  requireAuth,
  validate(bountySubmissionParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await rejectSubmission(req.user, req.params.id, req.params.submissionId));
  })
);

export default router;
