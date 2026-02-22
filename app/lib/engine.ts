// engine.ts — Facilitator game engine
// Generates x402 payment requests (valid & malformed), scoring, levels

// ─── Types ───────────────────────────────────────────────────────────────────

export type ErrorType =
  | 'valid'
  | 'wrong_scheme'
  | 'network_mismatch'
  | 'expired_valid_before'
  | 'future_valid_after'
  | 'insufficient_funds'
  | 'amount_mismatch'
  | 'recipient_mismatch'
  | 'bad_signature'
  | 'bad_nonce'
  | 'missing_field'
  | 'wrong_asset';

export interface PaymentRequest {
  id: string;
  timestamp: number;
  isValid: boolean;
  errorType: ErrorType;
  errorHint: string;
  payload: RequestPayload;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: number;
}

export interface RequestPayload {
  x402Version: number;
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  signature: string;
  balance: string;
}

export interface LevelConfig {
  level: number;
  name: string;
  description: string;
  requestInterval: number; // ms between requests
  maxQueue: number;
  requestTimeout: number; // ms before request expires
  validRatio: number; // 0-1 ratio of valid requests
  errorTypes: ErrorType[];
  requiredScore: number; // score needed to advance
  educationTip: string;
}

export interface GameState {
  level: number;
  score: number;
  health: number; // 0-100
  reputation: number; // 0-100
  streak: number;
  bestStreak: number;
  totalProcessed: number;
  correctDecisions: number;
  throughput: number; // requests per minute
  requests: PaymentRequest[];
  selectedId: string | null;
  phase: 'menu' | 'playing' | 'levelup' | 'gameover';
  levelStartTime: number;
  processedThisLevel: number;
  correctThisLevel: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VALID_NETWORK = 'eip155:8453';
const AGENT_NAMES = [
  'agent-alpha', 'defi-bot-9', 'oracle-x', 'sniper-v3', 'arb-runner',
  'yield-farm-ai', 'mev-scout', 'bridge-bot', 'liquidator', 'keeper-net',
  'price-feed-7', 'swap-engine', 'vault-mgr', 'risk-model', 'data-pipe',
];
const SELLER_ADDRS = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  '0x9A8f92a830A5cB89a3816e3D267CB7791c16b81D',
  '0x1234567890AbcdEF1234567890abcDEf12345678',
];

// ─── Levels ──────────────────────────────────────────────────────────────────

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'BOOT SEQUENCE',
    description: 'Learn the basics. Spot obvious errors.',
    requestInterval: 4000,
    maxQueue: 4,
    requestTimeout: 15000,
    validRatio: 0.6,
    errorTypes: ['missing_field', 'wrong_scheme'],
    requiredScore: 100,
    educationTip: 'x402 uses the "exact" scheme for EIP-3009 payments. Any other scheme is invalid.',
  },
  {
    level: 2,
    name: 'CHAIN VALIDATOR',
    description: 'Verify networks and assets match.',
    requestInterval: 3200,
    maxQueue: 5,
    requestTimeout: 12000,
    validRatio: 0.55,
    errorTypes: ['wrong_scheme', 'network_mismatch', 'wrong_asset'],
    requiredScore: 250,
    educationTip: 'Base mainnet is eip155:8453. USDC on Base is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Both must match.',
  },
  {
    level: 3,
    name: 'TIME WARDEN',
    description: 'Expired authorizations slip through.',
    requestInterval: 2600,
    maxQueue: 6,
    requestTimeout: 10000,
    validRatio: 0.5,
    errorTypes: ['expired_valid_before', 'future_valid_after', 'network_mismatch'],
    requiredScore: 500,
    educationTip: 'validBefore must be > now. validAfter must be <= now. EIP-3009 uses dual time bounds to prevent front-running AND late execution.',
  },
  {
    level: 4,
    name: 'BALANCE CHECKER',
    description: 'Verify funds and amounts.',
    requestInterval: 2200,
    maxQueue: 7,
    requestTimeout: 9000,
    validRatio: 0.45,
    errorTypes: ['insufficient_funds', 'amount_mismatch', 'expired_valid_before', 'wrong_scheme'],
    requiredScore: 800,
    educationTip: 'The facilitator checks on-chain balanceOf before settling. If value > balance, the tx would revert — reject early.',
  },
  {
    level: 5,
    name: 'SIGNATURE ANALYST',
    description: 'Bad signatures and replay attacks.',
    requestInterval: 1800,
    maxQueue: 8,
    requestTimeout: 8000,
    validRatio: 0.4,
    errorTypes: ['bad_signature', 'bad_nonce', 'recipient_mismatch', 'insufficient_funds', 'expired_valid_before'],
    requiredScore: 1200,
    educationTip: 'EIP-3009 uses random bytes32 nonces (not sequential). Each nonce can only be used once per address. Replay = rejected.',
  },
  {
    level: 6,
    name: 'RUSH HOUR',
    description: 'Everything at once. Maximum throughput.',
    requestInterval: 1200,
    maxQueue: 10,
    requestTimeout: 6000,
    validRatio: 0.4,
    errorTypes: [
      'wrong_scheme', 'network_mismatch', 'expired_valid_before', 'future_valid_after',
      'insufficient_funds', 'amount_mismatch', 'recipient_mismatch', 'bad_signature',
      'bad_nonce', 'missing_field', 'wrong_asset',
    ],
    requiredScore: 2000,
    educationTip: 'A real facilitator runs all 9 checks in milliseconds. The x402 SDK defines 12 distinct failure codes — no generic "payment failed."',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomAddr(): string {
  return randomHex(20);
}

function randomId(): string {
  return randomHex(4).slice(2);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// ─── Request Generation ──────────────────────────────────────────────────────

function generateValidPayload(): RequestPayload {
  const now = nowSec();
  const amount = pickRandom(['5000', '10000', '20000', '50000', '100000']);
  const seller = pickRandom(SELLER_ADDRS);
  const balance = String(Number(amount) + Math.floor(Math.random() * 500000));

  return {
    x402Version: 2,
    scheme: 'exact',
    network: VALID_NETWORK,
    asset: USDC_BASE,
    amount,
    payTo: seller,
    from: randomAddr(),
    to: seller,
    value: amount,
    validAfter: now - 600,
    validBefore: now + 30,
    nonce: randomHex(32),
    signature: randomHex(65),
    balance,
  };
}

function injectError(payload: RequestPayload, errorType: ErrorType): { payload: RequestPayload; hint: string } {
  const p = { ...payload };
  let hint = '';

  switch (errorType) {
    case 'wrong_scheme':
      p.scheme = pickRandom(['permit2', 'permit', 'eip2612', 'flex']);
      hint = `Scheme is "${p.scheme}" — x402 requires "exact"`;
      break;

    case 'network_mismatch':
      p.network = pickRandom(['eip155:1', 'eip155:42161', 'eip155:10', 'eip155:137']);
      hint = `Network ${p.network} doesn't match Base (eip155:8453)`;
      break;

    case 'wrong_asset':
      p.asset = pickRandom([
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        randomAddr(),
      ]);
      hint = `Asset ${p.asset.slice(0, 10)}... is not Base USDC`;
      break;

    case 'expired_valid_before': {
      const ago = Math.floor(Math.random() * 300) + 10;
      p.validBefore = nowSec() - ago;
      hint = `Authorization expired ${ago}s ago (validBefore: ${p.validBefore})`;
      break;
    }

    case 'future_valid_after':
      p.validAfter = nowSec() + Math.floor(Math.random() * 600) + 60;
      hint = `Authorization not active yet (validAfter: ${p.validAfter}, ${p.validAfter - nowSec()}s from now)`;
      break;

    case 'insufficient_funds': {
      const shortfall = Math.floor(Number(p.amount) * 0.3);
      p.balance = String(Number(p.amount) - shortfall);
      hint = `Balance ${p.balance} < required ${p.amount} (short by ${shortfall})`;
      break;
    }

    case 'amount_mismatch': {
      const requested = Number(p.amount);
      p.value = String(Math.floor(requested * (0.1 + Math.random() * 0.6)));
      hint = `Signed value ${p.value} < required amount ${p.amount}`;
      break;
    }

    case 'recipient_mismatch':
      p.to = randomAddr();
      hint = `Recipient ${p.to.slice(0, 10)}... doesn't match payTo ${p.payTo.slice(0, 10)}...`;
      break;

    case 'bad_signature':
      p.signature = randomHex(Math.random() > 0.5 ? 32 : 64);
      hint = `Invalid signature length: ${(p.signature.length - 2) / 2} bytes (expected 65)`;
      break;

    case 'bad_nonce':
      p.nonce = pickRandom([
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x' + 'ff'.repeat(32),
        randomHex(16), // too short
      ]);
      hint = p.nonce.length < 66
        ? `Nonce too short: ${(p.nonce.length - 2) / 2} bytes (expected 32)`
        : `Suspicious nonce: ${p.nonce.slice(0, 14)}... (all zeros or all ff)`;
      break;

    case 'missing_field': {
      const field = pickRandom(['scheme', 'network', 'nonce', 'signature', 'from'] as const);
      (p as Record<string, unknown>)[field] = '';
      hint = `Missing required field: ${field}`;
      break;
    }
  }

  return { payload: p, hint };
}

export function generateRequest(levelConfig: LevelConfig): PaymentRequest {
  const isValid = Math.random() < levelConfig.validRatio;
  const basePayload = generateValidPayload();
  const id = randomId();

  if (isValid) {
    return {
      id,
      timestamp: Date.now(),
      isValid: true,
      errorType: 'valid',
      errorHint: 'All checks pass — valid payment',
      payload: basePayload,
      status: 'pending',
      expiresAt: Date.now() + levelConfig.requestTimeout,
    };
  }

  const errorType = pickRandom(levelConfig.errorTypes);
  const { payload, hint } = injectError(basePayload, errorType);

  return {
    id,
    timestamp: Date.now(),
    isValid: false,
    errorType,
    errorHint: hint,
    payload,
    status: 'pending',
    expiresAt: Date.now() + levelConfig.requestTimeout,
  };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface DecisionResult {
  correct: boolean;
  scoreChange: number;
  healthChange: number;
  reputationChange: number;
  message: string;
}

export function evaluateDecision(
  request: PaymentRequest,
  action: 'approve' | 'reject',
  streak: number,
): DecisionResult {
  const streakBonus = Math.floor(streak / 3) * 5;

  if (request.isValid && action === 'approve') {
    return {
      correct: true,
      scoreChange: 20 + streakBonus,
      healthChange: 0,
      reputationChange: 2,
      message: 'SETTLED',
    };
  }

  if (!request.isValid && action === 'reject') {
    return {
      correct: true,
      scoreChange: 25 + streakBonus,
      healthChange: 0,
      reputationChange: 2,
      message: ERROR_NAMES[request.errorType] || 'REJECTED',
    };
  }

  if (request.isValid && action === 'reject') {
    return {
      correct: false,
      scoreChange: -10,
      healthChange: 0,
      reputationChange: -15,
      message: 'FALSE REJECT — valid payment blocked',
    };
  }

  // !isValid && approve
  return {
    correct: false,
    scoreChange: -15,
    healthChange: -20,
    reputationChange: 0,
    message: 'BAD SETTLEMENT — malformed tx approved',
  };
}

export function evaluateExpiry(request: PaymentRequest): DecisionResult {
  if (request.isValid) {
    return {
      correct: false,
      scoreChange: -5,
      healthChange: 0,
      reputationChange: -8,
      message: 'TIMEOUT — valid payment expired',
    };
  }
  // Letting an invalid request expire is slightly negative (you should have caught it)
  return {
    correct: false,
    scoreChange: -3,
    healthChange: -5,
    reputationChange: 0,
    message: 'TIMEOUT — malformed request expired',
  };
}

// ─── Error code display names ────────────────────────────────────────────────

const ERROR_NAMES: Record<ErrorType, string> = {
  valid: 'VALID',
  wrong_scheme: 'unsupported_scheme',
  network_mismatch: 'network_mismatch',
  expired_valid_before: 'invalid_valid_before',
  future_valid_after: 'invalid_valid_after',
  insufficient_funds: 'insufficient_funds',
  amount_mismatch: 'invalid_value',
  recipient_mismatch: 'recipient_mismatch',
  bad_signature: 'invalid_signature',
  bad_nonce: 'invalid_nonce',
  missing_field: 'missing_field',
  wrong_asset: 'invalid_asset',
};

// ─── Initial State ───────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    level: 1,
    score: 0,
    health: 100,
    reputation: 100,
    streak: 0,
    bestStreak: 0,
    totalProcessed: 0,
    correctDecisions: 0,
    throughput: 0,
    requests: [],
    selectedId: null,
    phase: 'menu',
    levelStartTime: 0,
    processedThisLevel: 0,
    correctThisLevel: 0,
  };
}

export function getAgentName(): string {
  return pickRandom(AGENT_NAMES);
}

export function formatUSDC(raw: string): string {
  const n = Number(raw);
  return '$' + (n / 1e6).toFixed(n >= 1e6 ? 2 : n >= 1e4 ? 4 : 6);
}

export function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '???';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}
