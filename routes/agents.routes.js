import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { asyncHandler, HttpError } from "../middlewares/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  agentListQuerySchema,
  idParamsSchema,
  userAgentCreateSchema,
  userAgentUpdateSchema,
  walletParamsSchema,
} from "../validators/schemas.js";
import {
  createUserAgent,
  disableUserAgent,
  getAgent,
  listActiveAgents,
  listAgentsByWallet,
  replaceUserAgentSkill,
  updateUserAgent,
} from "../services/agents.service.js";

const router = Router();

const agentCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const skillUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname !== "SKILL.md") {
      return cb(new HttpError(400, "Skill file must be named SKILL.md", "Bad Request"));
    }

    const allowedMimeTypes = new Set(["text/markdown", "text/plain", "application/octet-stream", ""]);
    if (!allowedMimeTypes.has(file.mimetype || "")) {
      return cb(new HttpError(400, "Skill file must be markdown or plain text", "Bad Request"));
    }

    return cb(null, true);
  },
});

function uploadSkill(req, res, next) {
  return skillUpload.single("skill")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof HttpError) return next(error);
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new HttpError(400, "SKILL.md must be 64 KB or smaller", "Bad Request"));
    }
    return next(new HttpError(400, error.message || "Invalid skill upload", "Bad Request"));
  });
}

router.get(
  "/agents",
  validate(agentListQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    res.json(await listActiveAgents(req.query));
  })
);

router.post(
  "/agents",
  requireAuth,
  agentCreateLimiter,
  uploadSkill,
  validate(userAgentCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createUserAgent(req.user, req.body, req.file));
  })
);

router.get(
  "/agents/:id",
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await getAgent(req.params.id));
  })
);

router.patch(
  "/agents/:id",
  requireAuth,
  validate(idParamsSchema, "params"),
  validate(userAgentUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateUserAgent(req.user, req.params.id, req.body));
  })
);

router.put(
  "/agents/:id/skill",
  requireAuth,
  validate(idParamsSchema, "params"),
  uploadSkill,
  asyncHandler(async (req, res) => {
    res.json(await replaceUserAgentSkill(req.user, req.params.id, req.file));
  })
);

router.post(
  "/agents/:id/disable",
  requireAuth,
  validate(idParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await disableUserAgent(req.user, req.params.id));
  })
);

router.get(
  "/users/:wallet/agents",
  requireAuth,
  validate(walletParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    res.json(await listAgentsByWallet(req.user, req.params.wallet));
  })
);

export default router;
