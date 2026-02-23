#!/usr/bin/env npx tsx
// deploy-agora.ts — Launch $AGORA token on Base via Clanker v4
//
// Usage:
//   PRIVATE_KEY=0x... npx tsx scripts/deploy-agora.ts
//   PRIVATE_KEY=0x... npx tsx scripts/deploy-agora.ts --dry-run
//
// Paired with USDC (native x402 payment token)
// Vault: 90% of supply, 7-day lockup, 83-day linear vesting (fully vested May 23)
// Rewards: 100% LP fees to deployer

import { Clanker } from 'clanker-sdk/v4';
import { FEE_CONFIGS, getTickFromMarketCapUSDC } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http, isHex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY || !isHex(PRIVATE_KEY)) {
  console.error('ERROR: Set PRIVATE_KEY env var (hex, 0x-prefixed)');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// Durations in seconds
const SEVEN_DAYS = 7 * 24 * 60 * 60;       // 604,800
const EIGHTY_THREE_DAYS = 83 * 24 * 60 * 60; // 7,171,200

// Base USDC (6 decimals)
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Target ~$25K starting market cap
const STARTING_MCAP_USD = 25_000;
const MAX_MCAP_USD = 1_000_000_000; // $1B ceiling for LP range
const TICK_SPACING = 200;

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient;
const wallet = createWalletClient({ account, chain: base, transport: http() });

// ─── Token Config ────────────────────────────────────────────────────────────

const TOKEN_CONFIG = {
  // Identity
  name: 'Agora',
  symbol: 'AGORA',
  tokenAdmin: account.address,
  chainId: base.id,

  // Logo on IPFS
  image: 'ipfs://QmVzMakrhak4aWWW9ocVQnXraSrAGv9X3XJProAqRQ9jH8',

  // Metadata
  metadata: {
    description: 'The digital marketplace where x402 payments come alive. Build autonomous payment infrastructure, deploy API endpoints, hire AI agents, and stake $AGORA to boost earnings. The game teaches x402 — the token unlocks real infrastructure.',
    socialMediaUrls: [
      { platform: 'website', url: 'https://agora.jumpbox.tech' },
      { platform: 'farcaster', url: 'https://farcaster.xyz/jumpbox.eth' },
      { platform: 'twitter', url: 'https://x.com/jumpbox_tech' },
    ],
  },

  // Context
  context: {
    interface: 'Agora Deploy Script',
    platform: 'farcaster',
    messageId: '',
    id: '',
  },

  // Vault: 90% locked, 7-day lockup, 83-day linear vesting
  // Timeline: Launch → Day 7 (lockup ends, vesting begins) → Day 90 (fully vested)
  // ~1.08B tokens unlock per day from day 7 to day 90
  vault: {
    percentage: 90,
    lockupDuration: SEVEN_DAYS,
    vestingDuration: EIGHTY_THREE_DAYS,
    recipient: account.address,
  },

  // No devBuy — will manually buy with USDC after launch
  // (devBuy only supports ETH, we're pairing with USDC)

  // Pool: USDC pair, custom positions for ~$25K starting mcap
  pool: {
    pairedToken: BASE_USDC,
    tickIfToken0IsClanker: getTickFromMarketCapUSDC(STARTING_MCAP_USD, TICK_SPACING),
    tickSpacing: TICK_SPACING,
    positions: [
      {
        // Full range: $25K mcap → $1B mcap
        tickLower: getTickFromMarketCapUSDC(STARTING_MCAP_USD, TICK_SPACING),
        tickUpper: getTickFromMarketCapUSDC(MAX_MCAP_USD, TICK_SPACING),
        positionBps: 10_000, // 100% of LP
      },
    ],
  },

  // Fees: 1% static both directions
  fees: FEE_CONFIGS.StaticBasic,

  // Anti-sniper: 66.7% decaying to 4.17% over 15 seconds
  sniperFees: {
    startingFee: 666_777,
    endingFee: 41_673,
    secondsToDecay: 15,
  },

  // Rewards: 100% of LP fees to deployer
  rewards: {
    recipients: [
      {
        admin: account.address,
        recipient: account.address,
        bps: 10_000,
        token: 'Both' as const,
      },
    ],
  },

  vanity: false,
};

// ─── Deploy ──────────────────────────────────────────────────────────────────

async function main() {
  const startTick = getTickFromMarketCapUSDC(STARTING_MCAP_USD, TICK_SPACING);
  const ceilTick = getTickFromMarketCapUSDC(MAX_MCAP_USD, TICK_SPACING);

  console.log('┌─────────────────────────────────────────┐');
  console.log('│         AGORA TOKEN LAUNCH               │');
  console.log('│         Clanker v4 on Base (USDC pair)    │');
  console.log('└─────────────────────────────────────────┘');
  console.log();
  console.log('Deployer:', account.address);
  console.log('Chain:    Base (8453)');
  console.log('Supply:   100,000,000,000 AGORA');
  console.log('Pair:     USDC (0x8335...02913)');
  console.log();
  console.log('Pool:');
  console.log('  Start:  ~$' + STARTING_MCAP_USD.toLocaleString() + ' mcap (tick ' + startTick + ')');
  console.log('  Ceil:   ~$' + MAX_MCAP_USD.toLocaleString() + ' mcap (tick ' + ceilTick + ')');
  console.log('  Spacing:', TICK_SPACING);
  console.log();
  console.log('Vault:    90% (90B tokens)');
  console.log('Lockup:   7 days');
  console.log('Vesting:  83 days linear (fully vested ~May 23)');
  console.log('Fees:     1%/1% static');
  console.log('Sniper:   66.7% → 4.17% over 15s');
  console.log('Rewards:  100% LP fees to deployer');
  console.log();

  if (!TOKEN_CONFIG.image) {
    console.warn('WARNING: No image set. Update TOKEN_CONFIG.image before launch.');
    console.warn('         Upload logo to IPFS and set ipfs://... URI');
    console.warn();
  }

  const clanker = new Clanker({ wallet, publicClient });

  if (DRY_RUN) {
    console.log('── DRY RUN: Simulating deployment... ──');
    try {
      const sim = await clanker.deploySimulate(TOKEN_CONFIG, account);
      if ('error' in sim && sim.error) {
        console.error('Simulation failed:', sim.error);
        process.exit(1);
      }
      console.log('Simulation passed. Deploy would succeed.');
      console.log('Simulated result:', JSON.stringify(sim, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } catch (err) {
      console.error('Simulation error:', err);
      process.exit(1);
    }
    return;
  }

  console.log('── DEPLOYING (this sends a real transaction)... ──');
  console.log();

  const result = await clanker.deploy(TOKEN_CONFIG);

  if ('error' in result && result.error) {
    console.error('Deploy failed:', result.error);
    process.exit(1);
  }

  console.log('TX submitted:', result.txHash);
  console.log('Waiting for confirmation...');

  const receipt = await result.waitForTransaction();

  if ('error' in receipt && receipt.error) {
    console.error('TX failed:', receipt.error);
    process.exit(1);
  }

  console.log();
  console.log('┌─────────────────────────────────────────┐');
  console.log('│         AGORA DEPLOYED                    │');
  console.log('└─────────────────────────────────────────┘');
  console.log();
  console.log('Token:    ', receipt.address);
  console.log('TX:       ', result.txHash);
  console.log('Explorer: ', `https://basescan.org/token/${receipt.address}`);
  console.log('DEX:      ', `https://dexscreener.com/base/${receipt.address}`);
  console.log();
  console.log('Next steps:');
  console.log('  1. Buy initial USDC position (swap 5 USDC → AGORA)');
  console.log('  2. Verify on Basescan');
  console.log('  3. Update Agora app with token address');
  console.log('  4. Claim vault tokens after 7-day lockup');
  console.log('     AGORA_TOKEN=<address> npx tsx scripts/claim-vault.ts');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
