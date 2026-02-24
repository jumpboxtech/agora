// contracts.ts — ABI definitions and addresses for Agora on-chain contracts

// ─── Addresses (Base mainnet) ───────────────────────────────────────────────

export const AGORA_TOKEN = '0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131' as const;
export const AGORA_STAKING = '0x2948e4CC6F368DFC34990F90B2cc7750E68Ef3B3' as const;
export const AGORA_AGENT_SUB_V1 = '0x4FF5385a533FF88fc848946cB13974F44201896b' as const;
export const AGORA_AGENT_SUB = '0xa94499B7F337FfD4a7B11dB4Ec55F9571cB726fd' as const; // V2 — USDC + auto buy/burn via V4
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const AGORA_REWARDS = '0x0fdaB9D5e76E6b6Ba882044900c1976Dd7648c4b' as const;
export const AGORA_REWARDS_V2 = '0xF7d3b7362021d0dd90E38006e87ac0DC1D537225' as const;
export const AGORA_LAUNCHPAD = '0x51f490d8d9baf2f785ba600d4d7732d424da6ea5' as const; // V2 — wired to AgentSubV2
export const AGORA_ENDPOINT_REGISTRY = '0xad8986fd512017945203c16f701a5261e1f7a5c6' as const; // V2 — wired to AgentSubV2
export const AGORA_ROUTER = '0xe540a5fb4822e14def1172ffc5c85f7da74379d4' as const; // V2 — wired to AgentSubV2
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

// ─── AgoraStaking ABI (read-only subset for frontend) ───────────────────────

export const STAKING_ABI = [
  {
    name: 'getUserStake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'staked', type: 'uint256' },
      { name: 'unstaking', type: 'uint256' },
      { name: 'unstakeAt', type: 'uint256' },
      { name: 'tier', type: 'uint8' },
      { name: 'bonusBps', type: 'uint256' },
    ],
  },
  {
    name: 'getStakeTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'getStakeBonus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalStaked',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalBurned',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalCommitted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'initiateUnstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claimUnstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

// ─── AgoraAgentSub ABI (read-only subset for frontend) ─────────────────────

export const AGENT_SUB_ABI = [
  {
    name: 'getSubscription',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'agentName', type: 'string' },
      { name: 'payTo', type: 'address' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'isActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isNameAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalBurned',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalActiveSubscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tierCosts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'subscribe',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'agentName', type: 'string' },
      { name: 'payTo', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'renew',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'updateAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentName', type: 'string' },
      { name: 'payTo', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'releaseName',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

// ─── ERC20 ABI (approve for staking/subscription) ──────────────────────────

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── AgoraRewards V1 ABI (legacy) ───────────────────────────────────────────

export const REWARDS_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'usedNonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalDistributed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalClaims',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'poolBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'signer',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ─── AgoraRewardsV2 ABI ─────────────────────────────────────────────────────

export const REWARDS_V2_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'fid', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'usedNonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalDistributed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalClaims',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'poolBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'signer',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'dailyWalletRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'dailyFidRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'fid', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'lifetimeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'cooldownRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxClaimAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'dailyWalletCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'dailyFidCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'lifetimeCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'claimCooldown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── AgoraLaunchpad ABI ─────────────────────────────────────────────────────

export const LAUNCHPAD_ABI = [
  {
    name: 'launch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
    ],
    outputs: [{ name: 'curveId', type: 'uint256' }],
  },
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'curveId', type: 'uint256' },
      { name: 'agoraAmount', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'curveId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minAgoraOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'agoraOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getCurve',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'curveId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'totalSupply', type: 'uint256' },
          { name: 'virtualAgora', type: 'uint256' },
          { name: 'k', type: 'uint256' },
          { name: 'agoraReserve', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'graduationAgora', type: 'uint256' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'accruedFees', type: 'uint256' },
          { name: 'graduated', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'creatorShareBps', type: 'uint256' },
          { name: 'uniswapPool', type: 'address' },
        ],
      },
    ],
  },
  {
    name: 'getAgentCurve',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'hasLaunched',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalCurves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getBuyQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'curveId', type: 'uint256' },
      { name: 'agoraAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getSellQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'curveId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'agoraOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'curveId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── AgoraEndpointRegistry ABI ──────────────────────────────────────────────

export const ENDPOINT_REGISTRY_ABI = [
  {
    name: 'registerEndpoints',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'endpointUrl', type: 'string' },
      { name: 'paths', type: 'string[]' },
      { name: 'prices', type: 'uint256[]' },
      { name: 'modes', type: 'uint8[]' },
    ],
    outputs: [],
  },
  {
    name: 'updateEndpoint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'path', type: 'string' },
      { name: 'priceAgora', type: 'uint256' },
      { name: 'paymentMode', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'removeEndpoint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'path', type: 'string' }],
    outputs: [],
  },
  {
    name: 'profiles',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'endpointUrl', type: 'string' },
      { name: 'totalTasks', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'endpointCount', type: 'uint256' },
    ],
  },
  {
    name: 'getAgentEndpoints',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'path', type: 'string' },
          { name: 'priceAgora', type: 'uint256' },
          { name: 'paymentMode', type: 'uint8' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'totalRegisteredAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getAgentAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── AgoraRouter ABI ────────────────────────────────────────────────────────

export const ROUTER_ABI = [
  {
    name: 'payForService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'agoraAmount', type: 'uint256' },
      { name: 'nonce', type: 'bytes16' },
      { name: 'endpointPath', type: 'string' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokensReceived', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'verifyPayment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'bytes16' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'payer', type: 'address' },
          { name: 'agent', type: 'address' },
          { name: 'curveId', type: 'uint256' },
          { name: 'agoraAmount', type: 'uint256' },
          { name: 'tokensReceived', type: 'uint256' },
          { name: 'fee', type: 'uint256' },
          { name: 'blockNumber', type: 'uint256' },
          { name: 'viaUniswap', type: 'bool' },
          { name: 'directPayment', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'isNonceAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'bytes16' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'payments', type: 'uint256' },
      { name: 'volume', type: 'uint256' },
    ],
  },
] as const;
