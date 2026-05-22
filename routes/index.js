import { Router } from "express";
import authRoutes from "./auth.routes.js";
import bountiesRoutes from "./bounties.routes.js";
import agentsRoutes from "./agents.routes.js";
import rentalsRoutes from "./agent-rentals.routes.js";
import agentRunsRoutes from "./agent-runs.routes.js";
import submissionsRoutes from "./submissions.routes.js";
import adminRoutes from "./admin.routes.js";
import reviewsRoutes from "./reviews.routes.js";
import paymentsRoutes from "./payments.routes.js";
import blockchainRoutes from "./blockchain.routes.js";
import billingRoutes from "./billing.routes.js";
import minipayRoutes from "./minipay.routes.js";

const router = Router();

router.use(authRoutes);
router.use(submissionsRoutes);
router.use(bountiesRoutes);
router.use(agentsRoutes);
router.use(rentalsRoutes);
router.use(agentRunsRoutes);
router.use(reviewsRoutes);
router.use(paymentsRoutes);
router.use(billingRoutes);
router.use(minipayRoutes);
router.use(blockchainRoutes);
router.use(adminRoutes);

export default router;
