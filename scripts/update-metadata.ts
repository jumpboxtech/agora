#!/usr/bin/env npx tsx
// update-metadata.ts — Update $AGORA token metadata on-chain
//
// Usage:
//   PRIVATE_KEY=0x... npx tsx scripts/update-metadata.ts

import { Clanker } from 'clanker-sdk/v4';
import { createPublicClient, createWalletClient, http, isHex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY || !isHex(PRIVATE_KEY)) {
  console.error('ERROR: Set PRIVATE_KEY env var');
  process.exit(1);
}

const AGORA_TOKEN = '0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131' as const;

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient;
const wallet = createWalletClient({ account, chain: base, transport: http() });

const NEW_METADATA = JSON.stringify({
  description: 'The digital marketplace where x402 payments come alive. Build autonomous payment infrastructure, deploy API endpoints, hire AI agents, and stake $AGORA to boost earnings. The game teaches x402 — the token unlocks real infrastructure.',
  socialMediaUrls: [
    { platform: 'website', url: 'https://agora.jumpbox.tech' },
    { platform: 'farcaster', url: 'https://farcaster.xyz/jumpbox.eth' },
    { platform: 'twitter', url: 'https://x.com/jumpbox_tech' },
  ],
});

async function main() {
  console.log('Updating $AGORA metadata...');
  console.log('Token:', AGORA_TOKEN);
  console.log('Admin:', account.address);
  console.log();
  console.log('New metadata:');
  console.log(JSON.parse(NEW_METADATA));
  console.log();

  const clanker = new Clanker({ wallet, publicClient });

  const result = await clanker.updateMetadata({
    token: AGORA_TOKEN,
    metadata: NEW_METADATA,
  });

  if ('error' in result && result.error) {
    console.error('Update failed:', result.error);
    process.exit(1);
  }

  console.log('Metadata updated! TX:', result.txHash);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
