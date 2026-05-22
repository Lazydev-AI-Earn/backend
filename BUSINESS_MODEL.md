# Business Model Notes

This backend supports a credit-based business model for renters, agent creators, and the wearelazydev platform.

## Parties

- Renter: user who rents an agent or consumes the rented agent API.
- Agent creator: user who creates an agent, sets instructions, uploads `SKILL.md`, and earns payout when the agent is consumed.
- Platform: wearelazydev, which provides backend, billing, AI provider integration, marketplace, and Celo payment rails.

## Credit Model

Default values:

```txt
1 credit = $0.01
creator revenue share = 60% of net revenue
default AI markup = 2.5x AI cost
minimum consume charge = 1 credit
```

Environment variables:

```env
CREDIT_USD_VALUE=0.01
CREATOR_REVENUE_SHARE_BPS=6000
DEFAULT_AI_MARKUP_BPS=25000
MIN_CONSUME_CHARGE_CREDITS=1
```

## Consumption Formula

```txt
AI cost = input token cost + cached input token cost + output token cost
charged credits = max(AI cost x markup / credit value, minimum consume charge)
net revenue credits = charged credits - AI cost credits
creator payout = net revenue credits x creator share
platform fee = charged credits - AI cost credits - creator payout
```

Official agents:

```txt
creator payout = 0
platform keeps net revenue
```

User-created agents:

```txt
creator payout accrues to CreatorPayout
platform keeps remaining net revenue
```

## AI Providers

Agents can use:

- `openai`
- `openai-compatible`
- `anthropic`

Relevant environment variables:

```env
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
ANTHROPIC_VERSION=2023-06-01
CLAUDE_MODEL=claude-sonnet-4-6
```

Pricing is stored in `AiModelPricing` and seeded from official provider pricing pages. Admins can inspect and update it through:

```txt
GET   /api/billing/ai-pricing
GET   /api/admin/ai-pricing
POST  /api/admin/ai-pricing
PATCH /api/admin/ai-pricing/:id
```

`AI_PRICING_JSON` can override database pricing during emergencies:

```env
AI_PRICING_JSON={"openai":{"gpt-5.4":{"input":2.5,"output":15}},"anthropic":{"claude-sonnet-4-6":{"input":3,"output":15}}}
```

Prices are expressed as USD per 1 million tokens.

When `MOCK_AI=false`, billing uses provider usage fields returned by OpenAI or Anthropic. The backend stores:

- input tokens
- cached input tokens
- output tokens
- provider raw usage payload
- pricing source
- usage source
- input/output USD price snapshot

When `MOCK_AI=true`, usage falls back to a deterministic local estimate.

## MiniPay Integration

Backend exposes:

```txt
GET  /api/minipay/config
POST /api/minipay/credit-purchases
```

MiniPay rules:

- Use stablecoin wording.
- Use "Network fee" wording.
- Do not require CELO from users.
- Supported symbols for MVP: `USDC`, `USDT`, `USDm`.
- Contract and token addresses must come from environment config or deployed contract data.

Environment variables:

```env
MINIPAY_APP_ID=
MINIPAY_SUPPORTED_TOKENS_JSON=[{"symbol":"USDC","decimals":6,"address":""},{"symbol":"USDT","decimals":6,"address":""},{"symbol":"USDm","decimals":18,"address":""}]
TREASURY_ADDRESS=
CELO_CHAIN_ID=42220
```

## Backend Records

Credit purchases:

- `Payment`
- `CreditLedger`
- `CreditBalance`

Agent API consumption:

- `AgentRun` with step `CONSUME`
- `AgentConsumption`
- `CreditLedger`
- `CreatorPayout`

AI pricing:

- `AiModelPricing`

## MVP Constraints

- Exact AI usage requires `MOCK_AI=false` and valid OpenAI or Anthropic API keys.
- Mock mode still uses local estimates because no provider call happens.
- MiniPay purchase confirmation is immediate only when `MOCK_PAYMENTS=true`.
- With `MOCK_PAYMENTS=false`, pass `txHash` and verify against deployed Celo payment contracts.
