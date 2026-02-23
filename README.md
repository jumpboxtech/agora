# Agora — x402 Infrastructure Tycoon

A Farcaster mini app and web platform where you build autonomous x402 payment infrastructure. Deploy APIs, hire AI agents, stake $AGORA, and eventually launch your own x402 agent on real infrastructure.

**Live at [agora.jumpbox.tech](https://agora.jumpbox.tech)**

## What is Agora?

Agora is an x402 infrastructure tycoon game built as a Farcaster mini app on Base mainnet. Players manage virtual infrastructure — deploying API endpoints, hiring AI agents, upgrading servers — while learning how x402 micropayments work. The $AGORA token bridges the game and real infrastructure: accrue enough through gameplay and staking, then subscribe to deploy your own x402 agent on Agora's shared Vercel infrastructure.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Chain | Base mainnet (EVM) |
| Wallet | wagmi v3, viem, Farcaster wallet connector |
| Contracts | Solidity, Foundry, OpenZeppelin |
| Farcaster | @farcaster/miniapp-sdk, @farcaster/miniapp-wagmi-connector |
| Deployment | Vercel |

## Smart Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| $AGORA Token | [`0x1Ea0b50581E80C1f4D7b2e23D4eAeeBbe57E131`](https://basescan.org/address/0x1Ea0b50581E80C1f4D7b2e23D4eAeeBbe57E131) |
| Staking | [`0x14C0b1E443C2889735e1C9237B22cDC1C9c77e43`](https://basescan.org/address/0x14C0b1E443C2889735e1C9237B22cDC1C9c77e43) |
| Agent Subscriptions | [`0x4FF5915C67c5Ea30BDf1bCa43435e67D3eCa896b`](https://basescan.org/address/0x4FF5915C67c5Ea30BDf1bCa43435e67D3eCa896b) |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main mini app — tycoon game with tabs (INFRA, MARKET, AGENTS, QUESTS, ABOUT) |
| `/stats` | Protocol statistics dashboard — on-chain staking and token data |
| `/docs` | Game mechanics, tokenomics, and contract documentation |
| `/agents` | Agent Launchpad portal — subscribe, deploy, and manage x402 agents |

## Project Structure

```
app/
├── agents/              # Agent Launchpad portal
│   ├── page.tsx         # Server component + metadata
│   └── AgentsClient.tsx # Tabbed portal (Overview, Launch, My Agent, Docs)
├── api/
│   ├── og/              # Open Graph image generation
│   ├── quests/          # Quest verification endpoints
│   └── state/           # Game state persistence (KV)
├── components/
│   ├── ClientPage.tsx   # SSR wrapper
│   ├── Demo.tsx         # Main tycoon game UI (~1600 lines)
│   ├── FrameSDK.tsx     # Farcaster SDK initialization
│   └── Providers.tsx    # wagmi + React Query providers
├── docs/                # Documentation page
├── lib/
│   ├── contracts.ts     # ABIs + contract addresses
│   ├── useAgoraStaking.ts    # Staking hook (stake, unstake, claim)
│   ├── useAgoraAgentSub.ts   # Agent subscription hook
│   ├── useAgoraRewards.ts    # Rewards hook
│   ├── agents.ts        # In-game AI agent definitions
│   ├── quests.ts        # Quest definitions + verification
│   └── gameState.ts     # Save/load game state
├── stats/               # Protocol stats dashboard
├── globals.css          # Tailwind + custom theme
├── layout.tsx           # Root layout (Rajdhani + JetBrains Mono fonts)
└── page.tsx             # Entry point
contracts/               # Foundry smart contracts
public/
├── images/              # Frame preview + splash images
└── .well-known/         # Farcaster manifest
```

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

Create a `.env.local` file:

```env
# KV store for game state persistence
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Neynar (Farcaster API) for quest verification
NEYNAR_API_KEY=

# Quest verification
NEXT_PUBLIC_FARCASTER_CHANNEL_URL=
```

## Deployment

```bash
# Build and deploy to Vercel
vercel build --prod && vercel deploy --prebuilt --prod
```

> **Note:** Always use `vercel build --prod` instead of raw `next build` — Vercel's GitHub auto-deploy can overwrite raw build output.

## Tokenomics

- **$AGORA** — ERC-20 on Base, 1B total supply
- **Staking** — 3 tiers: Bronze (10M), Silver (50M), Gold (100M) with increasing APY
- **Agent Subscriptions** — 3 tiers: Starter (50M/mo), Pro (100M/mo), Enterprise (250M/mo)
- **Burn** — 50% of all subscription fees are burned permanently

## Attribution

Built by [Jumpbox](https://jumpbox.tech) with [Claude](https://claude.ai) (Anthropic).

## License

MIT — see [LICENSE.md](LICENSE.md)
