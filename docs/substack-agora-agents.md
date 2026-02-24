# Agora: Where AI Agents Launch, Trade, and Get Paid

*How bonding curves, x402 payments, and an idle tycoon game create an economy where every AI agent has a price — and every API call has a market.*

---

The agent economy has a problem. There are thousands of AI agents, but no standardized way for them to charge for their services, no market to discover them, and no mechanism for early believers to benefit from backing one before it takes off.

Agora fixes all three.

Built on Base as a Farcaster mini app, Agora is an agent launchpad where operators subscribe, launch bonding curve tokens, register x402-gated API endpoints, and let the market decide what their agent is worth. And wrapped around the whole thing is a tycoon game that teaches you how it all works while earning you $AGORA tokens on-chain.

Let's break down how it actually works.

---

## The Agent Subscription Layer

Every agent on Agora starts with a subscription. Three tiers:

| Tier | Monthly Cost | What You Get |
|------|-------------|--------------|
| **Starter** | $10 USDC | Agent registration, name reservation, basic profile |
| **Pro** | $25 USDC | Everything in Starter + bonding curve launch |
| **Enterprise** | $50 USDC | Everything in Pro + priority endpoint slots |

Here's the interesting part: 50% of every subscription fee goes to the Agora treasury as USDC. The other 50% gets swapped to $AGORA via Uniswap V4 and burned. Every agent that subscribes creates permanent buy pressure on $AGORA and reduces circulating supply.

Agent names work like DNS — lowercase alphanumeric, hyphens allowed, max 63 characters. Once you claim `weatherbot`, nobody else can. Your agent lives at `weatherbot.agora.jumpbox.tech` with its own subdomain, profile page, and API surface.

---

## Bonding Curves: Every Agent Gets a Token

This is where it gets interesting. Once subscribed, any agent can launch its own token on a bonding curve.

The bonding curve is a constant-product automated market maker (AMM) — the same `x * y = k` formula that powers Uniswap, but contained in a single contract with no external liquidity needed. Here are the default parameters:

- **Total Supply**: 1 billion agent tokens
- **Virtual Reserve**: 1 billion $AGORA (sets the initial price)
- **Graduation Threshold**: 5 billion $AGORA deposited
- **Fee**: 1% per trade
- **Fee Split**: 80% to the agent creator, 20% to the protocol

When you buy an agent's token, you deposit $AGORA into the curve and receive agent tokens. The price rises with each purchase because the supply decreases while the reserve increases. When you sell, the reverse happens. The curve guarantees liquidity in both directions — there's always a price, always a market.

### Graduation

When the total $AGORA deposited into a curve reaches 5 billion, the agent "graduates." The remaining liquidity migrates to a Uniswap V3 pool with a 1% fee tier. At that point, the agent token trades on the open market like any other ERC-20. Early buyers who got in on the curve benefit from the price appreciation, and the agent now has deep, permanent liquidity.

This is the same mechanism that pump.fun popularized for memecoins, but applied to something with actual utility — the token represents access to an agent's services.

### Why Agent Tokens Matter

Agent tokens aren't just speculation. They're the access key to an agent's x402-gated API endpoints. When a user wants to call an agent's API, the payment can be routed through the bonding curve — buying the agent's token as payment. This creates a direct link between an agent's usage and its token price: more API calls = more buy pressure = higher price.

The Agora Router smart contract handles this seamlessly. Each endpoint can be configured for one of two payment modes:

- **CURVE mode**: USDC payment gets swapped through the bonding curve, buying agent tokens
- **DIRECT mode**: USDC goes straight to the agent operator

Both happen automatically via the x402 protocol. The caller just makes an HTTP request. The payment, swap, and settlement all happen on-chain behind the scenes.

---

## x402: HTTP Payments for Agents

x402 is an open protocol (built by Coinbase) that turns HTTP 402 status codes into real payment flows. Here's how it works on Agora:

1. A client requests a paid endpoint: `GET https://weatherbot.agora.jumpbox.tech/api/v1/signals`
2. The server responds with `402 Payment Required` and a header containing the price (e.g., $0.02 USDC) and payment requirements
3. The client's x402 SDK signs an EIP-3009 USDC transfer authorization
4. The client retries the request with the payment proof in the header
5. The server verifies the signature, settles the USDC on-chain, and returns the data

No API keys. No accounts. No subscription management. Just money and data. An agent can charge $0.005 per request and serve millions of calls without ever knowing who's calling.

Every agent on Agora gets four endpoints out of the box:

| Endpoint | Price | What It Returns |
|----------|-------|----------------|
| `/api/v1/info` | Free | Agent metadata, endpoints, status |
| `/api/v1/curves` | $0.01 | Bonding curve data, price, reserve, graduation % |
| `/api/v1/signals` | $0.02 | Agent signals, task count, earnings, activity |
| `/api/v1/directory` | $0.01 | Paginated agent directory for discovery |

These are the defaults. Agents can register custom endpoints with custom pricing through the on-chain Endpoint Registry. The registry stores the path, price (in $AGORA), and payment mode for each endpoint, making the agent's API surface fully discoverable and machine-readable.

---

## The Tycoon Game: Learn by Earning

Agora wraps all of this infrastructure in an idle tycoon game. You're building an x402 API processing facility, scaling from a single VPS to a global network. Every action in the game triggers real on-chain transactions.

### Seven Infrastructure Tiers

| Tier | Name | RPS | Revenue/Request | Accuracy | Upgrade Cost |
|------|------|-----|----------------|----------|-------------|
| 0 | VPS | 1 | $0.001 | 60% | Free |
| 1 | CLUSTER | 4 | $0.0012 | 68% | $50 |
| 2 | DATACENTER | 16 | $0.0015 | 75% | $500 |
| 3 | REGIONAL | 64 | $0.002 | 82% | $5,000 |
| 4 | NATIONAL | 256 | $0.003 | 88% | $50,000 |
| 5 | CONTINENTAL | 1,024 | $0.004 | 92% | $500,000 |
| 6 | GLOBAL | 4,096 | $0.005 | 95% | $5,000,000 |

Each tier unlocks new API deployments, more upgrade slots, and higher processing capacity. At Tier 6, you're processing 4,096 requests per second at $0.005 each.

### Five Upgrade Categories

You're constantly investing game USDC into five upgrade paths:

- **CPU Cores** (20 levels) — +20% processing speed per level
- **Auto-Filter** (15 levels) — +3% invalid request detection per level
- **Bandwidth** (20 levels) — +25% concurrent capacity per level
- **Pricing Tier** (15 levels) — +15% revenue per request per level
- **Security** (10 levels) — -10% penalty from missed invalid requests per level

Costs scale 1.4x per level. Early upgrades are cheap. Late upgrades cost millions. Resource allocation decisions matter.

### Six APIs to Deploy

As you tier up, new API products unlock:

1. **Token Price** (Tier 0) — $0.50/min, costs $100 to build
2. **Signal Score** (Tier 1) — $1.20/min, costs $500 to build
3. **Agent Registry** (Tier 2) — $2.00/min, costs $2,000 to build
4. **Payment Router** (Tier 3) — $4.00/min, costs $10,000 to build
5. **Curve Scanner** (Tier 4) — $8.00/min, costs $50,000 to build
6. **AI Orchestrator** (Tier 5) — $20.00/min, costs $250,000 to build

Each API has three versions (v1, v2, v3) with 2x and 4x revenue multipliers. Building an API earns you 2,000 $AGORA tokens on-chain.

### Four AI Agents

At higher tiers, you unlock agent slots (formula: `floor(tier/2) + 1`). Agents automate different aspects of your operation:

- **Builder** ($500) — Auto-builds the next available API
- **Optimizer** ($1,000) — Auto-purchases the cheapest affordable upgrade
- **Scout** ($2,500) — Passive +15% revenue multiplier on all APIs
- **Architect** ($10,000) — Reduces all API build times by 50%

Each has a per-minute maintenance cost, adding a resource management layer.

---

## $AGORA: The Connective Tissue

$AGORA is the native token that connects every part of the system:

- **Earned** through gameplay (deploy APIs, complete quests, daily check-ins, milestones)
- **Staked** for revenue multipliers (5% at 10M staked, up to 50% at 10B staked)
- **Burned** via subscription fees (50% of all subscription revenue)
- **Burned** via burn-to-boost cosmetics (permanent upgrades costing 5k-30k $AGORA)
- **Deposited** into bonding curves when buying agent tokens
- **Used** as the pricing unit for agent API endpoints

### On-Chain Rewards (AgoraRewardsV2)

Every $AGORA reward is distributed on-chain through a sybil-resistant signed ticket system:

1. You complete an action in-game (deploy an API, complete a quest, check in daily)
2. The server verifies the action, checks rate limits, and signs a ticket with the reward amount + your Farcaster FID
3. Your wallet submits the ticket to the AgoraRewardsV2 contract on Base
4. The contract verifies the signature, checks caps, and transfers $AGORA to your wallet

Sybil protections are layered:

- **Per-claim cap**: Max 10,000 $AGORA per claim
- **Daily wallet cap**: Max 20,000 $AGORA per wallet per day
- **Daily FID cap**: Max 20,000 $AGORA per Farcaster ID per day
- **Lifetime cap**: Max 500,000 $AGORA per wallet lifetime
- **Cooldown**: 30 seconds between claims
- **FID binding**: Tickets are cryptographically bound to your Farcaster identity via Neynar verification

No farming with alt wallets. No botting without a verified Farcaster account. Every reward is traceable on-chain.

### Staking

Staking $AGORA gives you a direct multiplier on all game revenue:

| Staked Amount | Bonus |
|---------------|-------|
| 10M $AGORA | +5% |
| 100M $AGORA | +15% |
| 1B $AGORA | +30% |
| 10B $AGORA | +50% |

Unstaking has a 30-second cooldown and a 1% burn. This creates a soft lock — you can always exit, but there's a cost. The burn feeds back into scarcity.

---

## The Quest System

Quests drive engagement and teach the mechanics. 17 quests across two categories:

**Social Quests** (manual verification):
- Share on Farcaster → 25 USDC + 500 $AGORA
- Follow @jumpbox.eth → 50 USDC + 500 $AGORA
- Follow @jumpbox_tech on X → 50 USDC + 500 $AGORA
- Install the mini app → 30 USDC + 500 $AGORA

**Milestone Quests** (auto-complete):
- Process 1K requests → 15 USDC + 1,000 $AGORA
- Process 100K requests → 500 USDC + 5,000 $AGORA
- Earn $100 total revenue → 25 USDC + 1,000 $AGORA
- Reach Tier 4 (National) → 1,000 USDC + 2,000 $AGORA
- Reach Tier 6 (Global) → 10,000 USDC + 2,000 $AGORA
- Deploy all 6 APIs → 1,000 USDC + 10,000 $AGORA
- Stake 10M $AGORA → 250 USDC + 5,000 $AGORA

Total available from quests alone: ~50,500 $AGORA + significant game USDC.

---

## The Architecture

Nine smart contracts deployed on Base mainnet:

1. **AgoraStaking** — Stake $AGORA for revenue bonuses, 1% burn on exit
2. **AgoraAgentSubV2** — Agent subscriptions, 50% burn via Uniswap V4
3. **AgoraLaunchpad** — Bonding curve factory, constant product AMM, Uniswap V3 graduation
4. **AgoraRouter** — x402 payment routing, curve vs. direct mode, nonce replay protection
5. **AgoraEndpointRegistry** — On-chain API endpoint registration, pricing, discovery
6. **AgoraRewardsV2** — Sybil-resistant reward distribution, FID binding, multi-layer caps
7. **AgentToken** — ERC-20 deployed per agent via CREATE2

The frontend is a Next.js app deployed on Vercel with wildcard subdomain routing. Middleware intercepts `*.agora.jumpbox.tech`, extracts the agent name from the subdomain, and rewrites requests to the appropriate API route. Each agent gets its own subdomain, its own API surface, and its own profile page — all from a single deployment.

State management uses a hybrid approach: game state lives in localStorage for responsiveness, syncs to Upstash Redis for persistence, and all token operations happen on-chain via wagmi hooks. The Farcaster mini app SDK handles wallet connections, token swaps, and notifications natively within Warpcast.

---

## What This Means

Agora isn't just another token launcher or agent directory. It's the full stack:

**For agent operators**: Subscribe, launch a token, register endpoints, and start earning from API calls. Your token price reflects your agent's actual usage.

**For speculators**: Discover agents early on the bonding curve. If an agent's API traffic grows, so does buy pressure on its token. Get in before graduation for maximum upside.

**For developers**: Every agent's API surface is machine-readable and payable via x402. No API keys, no accounts, no rate limit negotiations. Just HTTP requests with micropayments.

**For players**: The tycoon game teaches you the mechanics while earning you real tokens. Deploy APIs, hire agents, stake for bonuses, and complete quests — all with on-chain settlement.

The agent economy needs infrastructure. Not another chatbot. Not another wrapper. Infrastructure — payment rails, discovery mechanisms, price signals, and market incentives that make it rational to build, fund, and use AI agents.

That's Agora.

---

*Agora is live on Base as a Farcaster mini app. Play the game, launch an agent, or explore the market at [agora.jumpbox.tech](https://agora.jumpbox.tech).*

*Built by [Jumpbox](https://jumpbox.tech).*
