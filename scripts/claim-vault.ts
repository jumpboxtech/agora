#!/usr/bin/env npx tsx
// claim-vault.ts — Claim vested $AGORA tokens from Clanker vault
//
// Usage:
//   PRIVATE_KEY=0x... AGORA_TOKEN=0x... npx tsx scripts/claim-vault.ts
//   PRIVATE_KEY=0x... AGORA_TOKEN=0x... npx tsx scripts/claim-vault.ts --check

import { Clanker } from 'clanker-sdk/v4';
import { createPublicClient, createWalletClient, http, isHex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AGORA_TOKEN = process.env.AGORA_TOKEN;

if (!PRIVATE_KEY || !isHex(PRIVATE_KEY)) {
  console.error('ERROR: Set PRIVATE_KEY env var');
  process.exit(1);
}
if (!AGORA_TOKEN || !isHex(AGORA_TOKEN)) {
  console.error('ERROR: Set AGORA_TOKEN env var (token contract address)');
  process.exit(1);
}

const CHECK_ONLY = process.argv.includes('--check');

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient;
const wallet = createWalletClient({ account, chain: base, transport: http() });

async function main() {
  const clanker = new Clanker({ wallet, publicClient });
  const token = AGORA_TOKEN as `0x${string}`;

  // Check claimable amount (returns bigint or {error})
  let claimable: bigint;
  try {
    const result = await clanker.getVaultClaimableAmount({ token });
    claimable = result as bigint;
  } catch (err) {
    console.error('Failed to check claimable:', err);
    process.exit(1);
  }

  console.log('Vault status for $AGORA');
  console.log('Token:     ', token);
  console.log('Claimable: ', claimable!.toString());

  if (CHECK_ONLY) return;

  console.log();
  console.log('Claiming vested tokens...');

  try {
    const result = await clanker.claimVaultedTokens({ token });
    console.log('Claimed! TX:', (result as { txHash: string }).txHash ?? result);
  } catch (err) {
    console.error('Claim failed:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
