# lazydev Backend

Express ESM TypeScript backend for lazydev. It supports the existing GitHub OAuth and Reclaim zkTLS proof endpoints, plus the backend foundation for bounties, official AI agents, agent rentals, review pipeline, submissions, payments, and Celo-first blockchain placeholders.

## Requirements

- Node.js 20 LTS
- PostgreSQL, installed locally
- Redis, installed locally
- pnpm

## Local Setup

```sh
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

If PostgreSQL or Redis is not running yet on macOS with Homebrew:

```sh
brew install postgresql@14 redis
brew services start postgresql@14
brew services start redis
createdb lazydev
```

Then keep this default database URL in `.env`, or adjust it to your local PostgreSQL user and password:

```env
DATABASE_URL=postgresql://lazydev:lazydev@localhost:5432/lazydev?schema=public
REDIS_URL=redis://localhost:6379
```

The API runs on:

```txt
http://localhost:5050
```

The new API is under `/api`. Existing compatibility routes remain:

```txt
GET /getAccessToken
GET /generate-proof
```

## Core Commands

```sh
pnpm dev
pnpm worker
pnpm build
pnpm lint
pnpm prisma migrate dev
pnpm prisma db seed
```

`pnpm dev` starts the HTTP server from TypeScript. By default it also starts BullMQ workers when `START_WORKERS=true`.

## Environment

Important local variables:

```env
DATABASE_URL=postgresql://lazydev:lazydev@localhost:5432/lazydev?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-secret
MOCK_AI=true
MOCK_PAYMENTS=false
AGENT_API_KEY_ENCRYPTION_SECRET=replace-with-a-long-random-secret
CELO_CHAIN_ID=42220
RPC_URL=
BOUNTY_CONTRACT_ADDRESS=
AGENT_REGISTRY_CONTRACT_ADDRESS=
AGENT_RENTAL_CONTRACT_ADDRESS=
TREASURY_ADDRESS=
PINATA_JWT=
PINATA_GATEWAY_URL=
```

Do not hardcode Celo contract addresses in source. Set contract addresses through env when contracts exist. `CELO_CHAIN_ID=42220` is Celo Mainnet. Use `11142220` for Celo Sepolia.

## Auth Flow

1. Request a nonce:

```sh
curl "http://localhost:5050/api/auth/nonce?wallet=0x..."
```

2. Sign the returned `message` with the wallet.

3. Verify the signature:

```sh
curl -X POST http://localhost:5050/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x...","signature":"0x..."}'
```

Use the returned token as:

```txt
Authorization: Bearer <token>
```

## Main Endpoints

```txt
GET    /api/me
POST   /api/bounties
POST   /api/bounties/prepare
GET    /api/bounties
GET    /api/bounties/:id
PATCH  /api/bounties/:id
POST   /api/bounties/:id/approve-submission/:submissionId
POST   /api/bounties/:id/reject-submission/:submissionId
GET    /api/users/:wallet/bounties

GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PATCH  /api/agents/:id
PUT    /api/agents/:id/skill
POST   /api/agents/:id/disable
GET    /api/users/:wallet/agents

POST   /api/agent-rentals
GET    /api/agent-rentals/:id
GET    /api/users/:wallet/rentals
POST   /api/agent-rentals/:id/start
POST   /api/agent-rentals/:id/resume
POST   /api/agent-rentals/:id/cancel
POST   /api/agent-rentals/:id/consume
GET    /api/agent-rentals/:id/consumptions

GET    /api/agent-runs/:id

POST   /api/submissions
GET    /api/submissions/:id
GET    /api/bounties/:id/submissions
POST   /api/submissions/:id/approve
POST   /api/submissions/:id/reject

GET    /api/reviews/:id
GET    /api/payments
GET    /api/billing/business-model
GET    /api/billing/ai-pricing
GET    /api/billing/solve-estimate
GET    /api/billing/me
GET    /api/billing/consumptions
GET    /api/users/:wallet/creator-payouts
GET    /api/minipay/config
POST   /api/minipay/credit-purchases
GET    /api/blockchain/config
```

Admin endpoints require `ADMIN` role:

```txt
GET    /api/admin/bounties
GET    /api/admin/rentals
GET    /api/admin/agent-runs
GET    /api/admin/submissions
GET    /api/admin/payments
GET    /api/admin/ai-pricing
POST   /api/admin/ai-pricing
PATCH  /api/admin/ai-pricing/:id
POST   /api/admin/agents
PATCH  /api/admin/agents/:id
POST   /api/admin/agents/:id/disable
POST   /api/admin/bounties/:id/pause
POST   /api/admin/rentals/:id/mark-failed
POST   /api/admin/rentals/:id/retry
POST   /api/admin/submissions/:id/force-review
```

## Mock Pipeline

With:

```env
MOCK_AI=true
MOCK_PAYMENTS=false
START_WORKERS=true
```

Creating a paid rental automatically runs:

```txt
analyze -> solve -> build_submission -> review
```

If review score is at least `75`, the rental becomes `READY_TO_SUBMIT`. If `autoSubmitEnabled=true`, the backend creates a submission automatically when all safety checks pass.

## Agent Consumption And Credits

Renters can consume the rented agent API while a rental is active:

```sh
curl -X POST http://localhost:5050/api/agent-rentals/<rental-id>/consume \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"input":"Create a draft answer for this bounty","context":{"format":"markdown"}}'
```

Direct agent consumption creates an `AgentRun` with step `CONSUME`, calls the rented agent with its `SKILL.md` or fallback `systemPrompt`, stores provider token usage and a price snapshot in `AgentConsumption`, debits renter credits, and accrues creator payout for user-created agents.

Solve-bounty worker steps are billable checkpoints. `ANALYZE`, `SOLVE`, `BUILD_SUBMISSION`, `REVIEW`, and `REVISE` each check credits, store usage in `AgentConsumption`, debit `CreditLedger`, and pause the solve job as `CREDITS_REQUIRED` if the user needs to top up. After a successful MiniPay credit purchase, call `POST /api/agent-rentals/:id/resume` to enqueue the next unfinished step instead of restarting the whole solve flow.

Estimate solve-bounty credits before starting a solve job:

```sh
curl "http://localhost:5050/api/billing/solve-estimate?mode=SOLVE_REVIEW&provider=openai&model=gpt-5.4-nano"
```

Use `provider=anthropic&model=claude-sonnet-4-6` to preview the Claude cost path for an agent configured with Claude. The estimate returns `expected`, `withOneRevision`, and `worstCase` totals. It is calculated per pipeline step, so the minimum consume charge can apply multiple times in one solve flow.

Starting a solve-bounty job references the selected agent. Provider and model stay on the agent record:

```json
{
  "bountyId": "<bounty-id>",
  "agentId": "<agent-id>",
  "mode": "SOLVE_REVIEW"
}
```

Create or update the agent with `aiProvider` (`openai`, `openai-compatible`, or `anthropic`) and `model` to choose the execution path. The solve worker uses the agent configuration instead of a bounty-level provider override.

Credit purchases for MiniPay-compatible stablecoin flows:

```sh
curl -X POST http://localhost:5050/api/minipay/credit-purchases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amountCredits":"500","tokenSymbol":"USDC"}'
```

With `MOCK_PAYMENTS=false`, pass a Celo payment `txHash`; the backend verifies the receipt, token transfer, sender, recipient, amount, and contract event before crediting. `MOCK_PAYMENTS=true` is only a local development escape hatch.

Business model defaults:

```txt
1 credit = $0.01
user charge = max(real AI cost x markup, minimum consume charge)
creator share = 60% of net revenue
platform share = remaining net revenue after AI cost and creator payout
```

OpenAI and Claude are both supported through `aiProvider` on agents. Supported values are `openai`, `openai-compatible`, and `anthropic`; the companion `model` field stores the exact model selected at create-agent time.

AI pricing is seeded into `AiModelPricing` from official OpenAI and Claude API pricing pages. Admins can update it through `/api/admin/ai-pricing`. `AI_PRICING_JSON` is an emergency environment override and wins over database pricing. When `MOCK_AI=false`, consumption billing uses real provider usage fields from OpenAI or Anthropic responses. When `MOCK_AI=true`, billing falls back to deterministic token estimates for local development.

## Agent Skills

Official agents can load runtime instructions from local skill files:

```txt
agents/skills/<agent-slug>/SKILL.md
```

The agent slug is the source of truth. For example:

```txt
agents/skills/task-analyzer/SKILL.md
agents/skills/research-solver/SKILL.md
agents/skills/auto-review/SKILL.md
```

The AI pipeline prefers the matching `SKILL.md` file. If no skill file exists, it falls back to the agent `systemPrompt` stored in the database. Admin-created agents can use the same convention by adding `agents/skills/<new-agent-slug>/SKILL.md`.

Public agent endpoints expose only `hasSkill`. They never return raw `SKILL.md` content or `systemPrompt`.
When an agent has a per-agent API key, public endpoints expose only `hasApiKey` and `apiKeyLast4`.

Authenticated users can create public rentable agents. Use multipart form data when uploading skill files:

```sh
curl -X POST http://localhost:5050/api/agents \
  -H "Authorization: Bearer <token>" \
  -F "name=My Research Agent" \
  -F "slug=my-research-agent" \
  -F "description=Solves research bounty tasks with a custom workflow." \
  -F "category=RESEARCH" \
  -F "agentType=SOLVER" \
  -F "systemPrompt=You are my custom research agent. Return structured JSON only." \
  -F "aiProvider=anthropic" \
  -F "apiKey=sk-ant-..." \
  -F "skills=@./strategy.md;type=text/markdown" \
  -F "skills=@./review-checklist.md;type=text/markdown"
```

Uploaded skill files must be markdown files. Each file must be 64 KB or smaller, and the combined upload must be 256 KB or smaller. The backend bundles uploaded files into the runtime `agents/skills/<agent-slug>/SKILL.md` file. User-created agents are public and rentable immediately. The creator or an admin can update the agent, replace its skill bundle, or disable it.
Per-agent API keys are encrypted at rest using `AGENT_API_KEY_ENCRYPTION_SECRET`, used only for that agent's provider calls, and never returned by API responses.
User-created agents do not set a fixed rental price in the create flow. Direct agent access uses pay-as-you-go consumption billing.

Users can solve a bounty with their own custom agent:

```txt
1. POST /api/agents
2. GET /api/bounties/:id
3. Pick the custom agent from availableAgents
4. POST /api/agent-rentals with that agentId
5. The pipeline uses the rented custom agent when its agentType matches the current step
```

For example, a custom `SOLVER` agent drives the solve step. Official analyzer, builder, reviewer, revision, and submitter agents remain the fallback for steps the custom agent does not cover.

## Security Notes

- Public agent endpoints never return `systemPrompt`.
- Public agent endpoints never return raw `SKILL.md` content.
- Rental responses sanitize embedded agent objects and never expose creator prompts.
- Nonces are single-use and expire.
- Users cannot read other users' rentals.
- Admin mutation routes require `ADMIN`.
- AI output is sanitized before storage as final submission content.
- Auto-submit fails closed for high-risk tasks, low scores, missing final output, wallet actions, external account posting, and weak content.
<!-- docs improvement 1 3C53831A-9FFA-4DAA-80D7-41BAC3CD5D19 -->
<!-- docs improvement 2 ED916634-ACEC-4CD7-8199-EC1F1DE22D91 -->
<!-- docs improvement 3 CA0DAE72-8F88-45A9-83EA-EB8CA45C74EF -->
<!-- docs improvement 4 A583BC82-F0FC-4747-A870-D1EEAC22156F -->
<!-- docs improvement 5 7DB38BB4-778B-43D1-AC83-CF783273DA21 -->
<!-- docs improvement 6 B279A1F7-B13F-4424-8396-7D4146720F03 -->
<!-- docs improvement 7 9E6FBE83-560A-4E12-81CB-D9C028D5051D -->
<!-- docs improvement 8 A1931C19-D95C-4F73-9585-4EC4AA400AC2 -->
<!-- docs improvement 9 785091C7-8E27-4CE2-9A97-D63DA2F3B9E8 -->
<!-- docs improvement 10 60344FDB-BFF4-4CEC-8B6A-DF1A0AAB40CC -->
