-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PROJECT_OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BountyCategory" AS ENUM ('DEVELOPMENT', 'RESEARCH', 'CONTENT', 'TRANSLATION', 'QA_TESTING', 'COMMUNITY', 'DESIGN', 'DATA', 'WEB3_ANALYSIS');

-- CreateEnum
CREATE TYPE "BountyStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('CORE', 'RESEARCH', 'CONTENT', 'TRANSLATION', 'QA', 'WEB3_ANALYSIS', 'DEVELOPMENT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ANALYZER', 'SOLVER', 'REVIEWER', 'REVISION', 'SUBMITTER', 'BUILDER');

-- CreateEnum
CREATE TYPE "RentalMode" AS ENUM ('ANALYZE_ONLY', 'SOLVE_DRAFT', 'SOLVE_REVIEW', 'AUTO_SUBMIT');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID', 'ANALYZING', 'SOLVING', 'BUILDING_SUBMISSION', 'REVIEWING', 'REVISING', 'READY_TO_SUBMIT', 'SUBMITTED', 'FAILED', 'CANCELLED', 'NEEDS_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "AgentRunStep" AS ENUM ('ANALYZE', 'SOLVE', 'BUILD_SUBMISSION', 'REVIEW', 'REVISE', 'SUBMIT');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'AUTO_REVIEWED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_NEEDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('AGENT_RENTAL', 'BOUNTY_REWARD', 'PLATFORM_FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PASSED', 'NEEDS_REVISION', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL,
    "chainBountyId" TEXT,
    "creatorWallet" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BountyCategory" NOT NULL,
    "requirements" JSONB NOT NULL,
    "submissionFormat" TEXT,
    "rewardAmount" DECIMAL(36,18) NOT NULL,
    "rewardToken" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "BountyStatus" NOT NULL DEFAULT 'OPEN',
    "metadataUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "chainAgentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AgentCategory" NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT,
    "price" DECIMAL(36,18) NOT NULL,
    "paymentToken" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRental" (
    "id" TEXT NOT NULL,
    "chainRentalId" TEXT,
    "bountyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "mode" "RentalMode" NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'CREATED',
    "paymentTxHash" TEXT,
    "autoSubmitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewScore" INTEGER,
    "revisionAttempts" INTEGER NOT NULL DEFAULT 0,
    "finalOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "step" "AgentRunStep" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "score" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "bountyId" TEXT NOT NULL,
    "rentalId" TEXT,
    "userWallet" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proofUrl" TEXT,
    "contentHash" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewScore" INTEGER,
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "tokenAddress" TEXT,
    "txHash" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "relatedBountyId" TEXT,
    "relatedRentalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewResult" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT,
    "submissionId" TEXT,
    "score" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "missingRequirements" JSONB NOT NULL,
    "qualityIssues" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "readyToSubmit" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Bounty_creatorWallet_idx" ON "Bounty"("creatorWallet");

-- CreateIndex
CREATE INDEX "Bounty_category_status_idx" ON "Bounty"("category", "status");

-- CreateIndex
CREATE INDEX "Bounty_rewardAmount_idx" ON "Bounty"("rewardAmount");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE INDEX "Agent_category_agentType_idx" ON "Agent"("category", "agentType");

-- CreateIndex
CREATE INDEX "Agent_isOfficial_isActive_idx" ON "Agent"("isOfficial", "isActive");

-- CreateIndex
CREATE INDEX "AgentRental_userWallet_idx" ON "AgentRental"("userWallet");

-- CreateIndex
CREATE INDEX "AgentRental_bountyId_idx" ON "AgentRental"("bountyId");

-- CreateIndex
CREATE INDEX "AgentRental_agentId_idx" ON "AgentRental"("agentId");

-- CreateIndex
CREATE INDEX "AgentRental_status_idx" ON "AgentRental"("status");

-- CreateIndex
CREATE INDEX "AgentRun_rentalId_step_idx" ON "AgentRun"("rentalId", "step");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "Submission_bountyId_idx" ON "Submission"("bountyId");

-- CreateIndex
CREATE INDEX "Submission_rentalId_idx" ON "Submission"("rentalId");

-- CreateIndex
CREATE INDEX "Submission_userWallet_idx" ON "Submission"("userWallet");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Payment_userWallet_idx" ON "Payment"("userWallet");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_relatedBountyId_idx" ON "Payment"("relatedBountyId");

-- CreateIndex
CREATE INDEX "Payment_relatedRentalId_idx" ON "Payment"("relatedRentalId");

-- CreateIndex
CREATE INDEX "ReviewResult_rentalId_idx" ON "ReviewResult"("rentalId");

-- CreateIndex
CREATE INDEX "ReviewResult_submissionId_idx" ON "ReviewResult"("submissionId");

-- CreateIndex
CREATE INDEX "ReviewResult_status_idx" ON "ReviewResult"("status");

-- CreateIndex
CREATE INDEX "Nonce_walletAddress_used_idx" ON "Nonce"("walletAddress", "used");

-- CreateIndex
CREATE INDEX "Nonce_expiresAt_idx" ON "Nonce"("expiresAt");

-- AddForeignKey
ALTER TABLE "AgentRental" ADD CONSTRAINT "AgentRental_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRental" ADD CONSTRAINT "AgentRental_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "AgentRental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "AgentRental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_relatedBountyId_fkey" FOREIGN KEY ("relatedBountyId") REFERENCES "Bounty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_relatedRentalId_fkey" FOREIGN KEY ("relatedRentalId") REFERENCES "AgentRental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewResult" ADD CONSTRAINT "ReviewResult_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "AgentRental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewResult" ADD CONSTRAINT "ReviewResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
