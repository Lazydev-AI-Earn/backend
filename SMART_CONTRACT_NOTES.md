# Smart Contract Notes For wearelazydev

Dokumen ini berisi catatan untuk tim smart contract wearelazydev.

Backend saat ini sudah menangani bounty, agent registry, agent rental, AI pipeline, review, revision, dan submission secara offchain. Smart contract perlu menangani bagian onchain: escrow reward, agent rental payment, fee split, reward release, refund, dan event sync.

## Celo Context

- Target utama: Celo.
- Celo Mainnet chain ID: `42220`.
- Celo Sepolia chain ID: `11142220`.
- Jangan hardcode contract address di backend.
- Backend membaca address dari environment variable:
  - `BOUNTY_CONTRACT_ADDRESS`
  - `AGENT_RENTAL_CONTRACT_ADDRESS`
  - `TREASURY_ADDRESS`
  - `RPC_URL`
- Contract tidak perlu handle fee abstraction secara khusus. Wallet atau transaction sender yang mengatur `feeCurrency`.

## Contracts To Build

### 1. BountyEscrow

Tujuan:

- Membuat bounty onchain.
- Menyimpan reward bounty di escrow.
- Release reward ke solver saat submission disetujui.
- Refund jika bounty expired atau cancelled.

Data minimal:

```solidity
struct Bounty {
    uint256 id;
    address creator;
    address rewardToken;
    uint256 rewardAmount;
    uint256 deadline;
    string metadataUri;
    BountyStatus status;
}
```

Status:

```solidity
enum BountyStatus {
    OPEN,
    FUNDED,
    SUBMITTED,
    APPROVED,
    CANCELLED,
    EXPIRED
}
```

Required functions:

```solidity
function createBounty(
    address rewardToken,
    uint256 rewardAmount,
    uint256 deadline,
    string calldata metadataUri
) external returns (uint256 bountyId);

function fundBounty(uint256 bountyId) external;

function approveAndRelease(
    uint256 bountyId,
    address winner,
    bytes32 submissionHash,
    string calldata proofUri
) external;

function cancelBounty(uint256 bountyId) external;

function refundExpiredBounty(uint256 bountyId) external;
```

Rules:

- Only bounty creator can approve and release reward.
- Only bounty creator can cancel before reward release.
- Cannot release reward twice.
- Cannot refund before deadline.
- Cannot cancel after reward release.
- Use `SafeERC20`.
- Store amount in raw token units.
- Do not assume token decimals.

### 2. AgentRegistry

Tujuan:

- Register official agent.
- Register user-created agent.
- Update agent metadata and price.
- Disable agent.
- Expose owner, payment token, and price for rental.

Data minimal:

```solidity
struct Agent {
    uint256 id;
    address owner;
    address paymentToken;
    uint256 price;
    string metadataUri;
    bool isOfficial;
    bool isActive;
}
```

Required functions:

```solidity
function registerAgent(
    address owner,
    address paymentToken,
    uint256 price,
    string calldata metadataUri,
    bool isOfficial
) external returns (uint256 agentId);

function updateAgent(
    uint256 agentId,
    address paymentToken,
    uint256 price,
    string calldata metadataUri
) external;

function disableAgent(uint256 agentId) external;
```

Rules:

- Admin or protocol can register official agents.
- Normal users can register their own agents.
- Agent owner can update or disable their own agent.
- Admin can disable any agent.
- Disabled agent cannot be rented.
- `metadataUri` should point to offchain metadata.
- Do not store raw prompt or `SKILL.md` onchain.

### 3. AgentRental

Tujuan:

- Rent an agent.
- Pay agent rental fee.
- Split fee between agent owner and treasury.
- Mark rental completed or cancelled.

Data minimal:

```solidity
struct Rental {
    uint256 id;
    uint256 bountyId;
    uint256 agentId;
    address renter;
    address paymentToken;
    uint256 amount;
    RentalStatus status;
}
```

Status:

```solidity
enum RentalStatus {
    PAID,
    COMPLETED,
    CANCELLED,
    REFUNDED
}
```

Required functions:

```solidity
function rentAgent(
    uint256 bountyId,
    uint256 agentId,
    string calldata metadataUri
) external returns (uint256 rentalId);

function markRentalCompleted(uint256 rentalId) external;

function cancelRental(uint256 rentalId) external;
```

Rules:

- Agent must be active.
- Rental fee is paid in `agent.paymentToken`.
- If agent is official, fee goes to treasury.
- If agent is user-created, fee is split between agent owner and treasury.
- Platform fee should use basis points.
- Platform fee must have a max cap.
- Recommended max cap: `2000` bps.
- Use `SafeERC20`.

## Required Events

Backend worker `blockchain.sync` should be able to sync all important state from events.

```solidity
event BountyCreated(
    uint256 indexed bountyId,
    address indexed creator,
    address rewardToken,
    uint256 rewardAmount,
    uint256 deadline,
    string metadataUri
);

event BountyFunded(
    uint256 indexed bountyId,
    address indexed funder,
    address rewardToken,
    uint256 amount
);

event BountyCancelled(uint256 indexed bountyId);
event BountyExpired(uint256 indexed bountyId);

event SubmissionApproved(
    uint256 indexed bountyId,
    address indexed winner,
    bytes32 submissionHash,
    string proofUri
);

event RewardReleased(
    uint256 indexed bountyId,
    address indexed winner,
    address rewardToken,
    uint256 amount
);

event AgentRegistered(
    uint256 indexed agentId,
    address indexed owner,
    bool isOfficial,
    address paymentToken,
    uint256 price,
    string metadataUri
);

event AgentUpdated(uint256 indexed agentId, string metadataUri);
event AgentDisabled(uint256 indexed agentId);

event AgentRented(
    uint256 indexed rentalId,
    uint256 indexed bountyId,
    uint256 indexed agentId,
    address renter,
    address paymentToken,
    uint256 amount,
    string metadataUri
);

event RentalCompleted(uint256 indexed rentalId);
event RentalCancelled(uint256 indexed rentalId);
```

## Backend Mapping

Backend already has fields for onchain IDs:

- `Bounty.chainBountyId`
- `Agent.chainAgentId`
- `AgentRental.chainRentalId`
- `Payment.txHash`
- `Submission.txHash`
- `Submission.contentHash`

Smart contract should return:

- `bountyId`
- `agentId`
- `rentalId`

Backend will store the returned IDs in the fields above.

Do not store long content onchain. Store only:

- `metadataUri`
- `submissionHash`
- `proofUri`

Keep these offchain in backend:

- Full bounty text
- Agent prompt
- Agent `SKILL.md`
- AI review result
- Final submission content
- Attachments

## Token And Payment Rules

MVP recommendation:

- Use ERC20 reward tokens.
- Use ERC20 rental payment tokens.
- Use token allowlist.
- Do not accept arbitrary ERC20 without allowlist.
- Do not support native CELO in MVP.
- Do not assume token decimals.
- Backend and frontend should pass raw token units.

Important token detail:

- USDC and USDT usually use 6 decimals.
- USDm and Mento style stablecoins can use 18 decimals.
- Always verify decimals per token address.

## Access Control

Recommended roles:

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");
```

Rules:

- Admin can manage allowlist, treasury, fee config, and official agents.
- Pauser can pause critical functions.
- Backend role can mark rental completed if the team wants backend-controlled state sync.
- Bounty creator controls bounty approval.
- Agent owner controls their own user-created agent.

## Security Requirements

Use:

- `AccessControl` or `Ownable`
- `Pausable`
- `ReentrancyGuard`
- `SafeERC20`

Must prevent:

- Double reward release.
- Rental for disabled agent.
- Approval by non-creator.
- Refund before deadline.
- Cancel after reward release.
- Platform fee above max cap.
- Zero treasury address.
- Zero token address unless native CELO support is intentionally added.
- Arbitrary external calls.
- Prompt or `SKILL.md` leakage onchain.

Recommended custom errors:

```solidity
error Unauthorized();
error InvalidToken();
error InvalidAmount();
error InvalidDeadline();
error BountyNotFound();
error BountyNotFunded();
error BountyNotOpen();
error BountyAlreadyReleased();
error AgentNotFound();
error AgentInactive();
error RentalNotFound();
error FeeTooHigh();
error TransferFailed();
```

## Deployment Notes

- Deploy to Celo Sepolia first.
- Verify contracts on Celo explorer.
- Set backend env after deployment:
  - `BOUNTY_CONTRACT_ADDRESS`
  - `AGENT_RENTAL_CONTRACT_ADDRESS`
  - `TREASURY_ADDRESS`
  - `RPC_URL`
- Run backend with `MOCK_PAYMENTS=false` only after payment verification is connected.
- Keep `MOCK_AI=true` available for local testing.

## Smart Contract Acceptance Criteria

Contract work is ready for backend integration when:

1. Project owner can create bounty onchain.
2. Project owner can fund bounty reward.
3. Backend can store `chainBountyId`.
4. User can rent active agent.
5. Backend can store `chainRentalId`.
6. Rental fee goes to treasury or split receiver.
7. User-created agent owner can receive rental share.
8. Disabled agent cannot be rented.
9. Bounty creator can approve submission and release reward.
10. Reward cannot be released twice.
11. Expired or cancelled bounty can be refunded.
12. Events expose all state needed by backend sync worker.
13. Contract has unit tests for success and revert paths.
14. Contract is verified on Celo Sepolia explorer.

