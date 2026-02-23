// engine.ts — Agora idle tycoon engine
// x402 payment processing infrastructure simulator
// Dual currency: USDC (in-game) + $AGORA (token rewards)

import { type APIState, getApiDef, apiRevenue, effectiveBuildTime, maxApiSlots, createInitialApis, updateApiAvailability } from './apis';
import { type AgentState, totalMaintenance, isScoutActive, isArchitectActive, maxAgentSlots, createInitialAgents } from './agents';
import { getStakeBonus } from './staking';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'speed' | 'accuracy' | 'bandwidth' | 'pricing' | 'security';
  cost: number;
  level: number;
  maxLevel: number;
  effect: number;
  icon: string;
}

export interface InfraTier {
  id: number;
  name: string;
  description: string;
  cost: number;
  baseRps: number;
  baseRevenue: number;
  baseAccuracy: number;
  unlockText: string;
  x402Insight: string;
}

export interface ProcessedCall {
  id: string;
  amount: number;
  valid: boolean;
  caught: boolean;
  settled: boolean;
  timestamp: number;
}

export interface FeedEvent {
  id: string;
  type: 'call' | 'api' | 'agent' | 'fac';
  text: string;
  color: string;
  timestamp: number;
}

export interface StakingState {
  staked: number;
  unstakingAmount: number;
  unstakeAt: number;
}

export interface GameState {
  // Core
  phase: 'menu' | 'playing' | 'paused';
  balance: number;         // USDC
  totalEarned: number;
  totalProcessed: number;
  totalSettled: number;
  totalRejected: number;
  totalMissed: number;

  // Infrastructure
  tier: number;
  upgrades: Record<string, number>;

  // Processing stats (derived, recomputed)
  rps: number;
  accuracy: number;
  revenuePerReq: number;
  bandwidth: number;
  securityPenalty: number;

  // APIs
  apis: APIState[];
  apiSlots: number;

  // Agents
  agents: AgentState[];
  agentSlots: number;

  // $AGORA token (in-game dummy balance)
  agoraBalance: number;
  agoraTotalEarned: number;
  agoraStaked: number;
  agoraStakeBonus: number;
  agoraTotalBurned: number;
  agoraDailyCheckin: number;

  // Burn-to-boost permanent upgrades
  burnBoosts: string[];     // IDs of purchased burn boosts

  // Staking
  staking: StakingState;

  // Live feed
  recentCalls: ProcessedCall[];
  feedEvents: FeedEvent[];
  callsPerSecond: number;

  // Tutorial
  tutorialStep: number;     // -1 = completed, 0+ = current step

  // Timestamps
  lastTick: number;
  sessionStart: number;
  totalPlayTime: number;

  // Offline summary (populated on load)
  offlineSummary: OfflineSummary | null;
}

export interface OfflineSummary {
  durationSec: number;
  usdcEarned: number;
  apiRevenue: number;
  maintenancePaid: number;
  apisBuilt: string[];
  upgradesBought: string[];
  agoraEarned: number;
}

// ─── Infrastructure Tiers ────────────────────────────────────────────────────

export const TIERS: InfraTier[] = [
  {
    id: 0, name: 'VPS', description: 'Single virtual server',
    cost: 0, baseRps: 1, baseRevenue: 0.001, baseAccuracy: 0.60,
    unlockText: 'Boot sequence initialized',
    x402Insight: 'x402 adds a 402 Payment Required response to HTTP. Agora verifies EIP-3009 signatures before settling USDC.',
  },
  {
    id: 1, name: 'CLUSTER', description: '4-node processing cluster',
    cost: 50, baseRps: 4, baseRevenue: 0.0012, baseAccuracy: 0.68,
    unlockText: 'Load balancer online',
    x402Insight: 'Agora checks 9 fields per request: scheme, network, asset, amount, value, from/to, validBefore, validAfter, nonce, and signature.',
  },
  {
    id: 2, name: 'DATACENTER', description: 'Dedicated facility',
    cost: 500, baseRps: 16, baseRevenue: 0.0015, baseAccuracy: 0.75,
    unlockText: 'Rack space secured',
    x402Insight: 'EIP-3009 uses transferWithAuthorization \u2014 gasless for the payer. Agora fronts gas, recoups from the payment itself.',
  },
  {
    id: 3, name: 'REGIONAL', description: 'Multi-zone deployment',
    cost: 5000, baseRps: 64, baseRevenue: 0.002, baseAccuracy: 0.82,
    unlockText: 'Edge nodes propagating',
    x402Insight: 'x402 nonces are random bytes32, not sequential. Each nonce is single-use per address \u2014 replay attacks are impossible.',
  },
  {
    id: 4, name: 'NATIONAL', description: 'Coast-to-coast backbone',
    cost: 50000, baseRps: 256, baseRevenue: 0.003, baseAccuracy: 0.88,
    unlockText: 'Peering agreements signed',
    x402Insight: 'Base USDC uses 6 decimals. Agora must verify on-chain balanceOf before calling transferWithAuthorization.',
  },
  {
    id: 5, name: 'CONTINENTAL', description: 'Cross-border infrastructure',
    cost: 500000, baseRps: 1024, baseRevenue: 0.004, baseAccuracy: 0.92,
    unlockText: 'Submarine cables lit',
    x402Insight: 'The 402 response includes a payment-required header with base64 JSON \u2014 the exact amount, asset, network, and payTo address.',
  },
  {
    id: 6, name: 'GLOBAL', description: 'Planetary-scale mesh',
    cost: 5000000, baseRps: 4096, baseRevenue: 0.005, baseAccuracy: 0.95,
    unlockText: 'Full coverage achieved',
    x402Insight: 'A mature Agora node processes thousands of x402 payments per second across multiple chains. You built one from a single VPS.',
  },
];

// ─── Upgrades ────────────────────────────────────────────────────────────────

export const UPGRADES: Upgrade[] = [
  { id: 'cpu', name: 'CPU CORES', description: '+20% processing speed', category: 'speed', cost: 10, level: 0, maxLevel: 20, effect: 0.20, icon: '\u26A1' },
  { id: 'filter', name: 'AUTO-FILTER', description: '+3% invalid detection', category: 'accuracy', cost: 25, level: 0, maxLevel: 15, effect: 0.03, icon: '\uD83D\uDEE1' },
  { id: 'pipe', name: 'BANDWIDTH', description: '+25% concurrent capacity', category: 'bandwidth', cost: 15, level: 0, maxLevel: 20, effect: 0.25, icon: '\uD83D\uDCE1' },
  { id: 'price', name: 'PRICING TIER', description: '+15% revenue per request', category: 'pricing', cost: 40, level: 0, maxLevel: 15, effect: 0.15, icon: '\uD83D\uDCB0' },
  { id: 'sec', name: 'SECURITY', description: '-10% penalty from missed invalids', category: 'security', cost: 30, level: 0, maxLevel: 10, effect: 0.10, icon: '\uD83D\uDD12' },
];

// ─── Cost Scaling ────────────────────────────────────────────────────────────

export function getUpgradeCost(base: number, level: number): number {
  return Math.floor(base * Math.pow(1.4, level));
}

// ─── Compute Effective Stats ─────────────────────────────────────────────────

export function computeStats(
  tier: number,
  upgrades: Record<string, number>,
  burnBoosts?: string[],
) {
  const t = TIERS[tier] || TIERS[0];

  const cpuLevel = upgrades['cpu'] || 0;
  const filterLevel = upgrades['filter'] || 0;
  const pipeLevel = upgrades['pipe'] || 0;
  const priceLevel = upgrades['price'] || 0;
  const secLevel = upgrades['sec'] || 0;

  // Base burn boost values
  let burnAccuracy = 0;
  let burnBandwidth = 0;
  let burnRevenue = 0;
  if (burnBoosts) {
    for (const id of burnBoosts) {
      if (id.startsWith('acc_')) burnAccuracy += id === 'acc_1' ? 0.01 : 0.02;
      if (id.startsWith('bw_')) burnBandwidth += id === 'bw_1' ? 0.05 : 0.10;
      if (id.startsWith('rev_')) burnRevenue += id === 'rev_1' ? 0.03 : 0.06;
    }
  }

  const rps = t.baseRps * (1 + cpuLevel * 0.20) * (1 + pipeLevel * 0.25) * (1 + burnBandwidth);
  const accuracy = Math.min(0.99, t.baseAccuracy + filterLevel * 0.03 + burnAccuracy);
  const revenuePerReq = t.baseRevenue * (1 + priceLevel * 0.15) * (1 + burnRevenue);
  const securityPenalty = Math.max(0.01, 0.30 - secLevel * 0.10);
  const bandwidth = Math.floor(t.baseRps * (1 + pipeLevel * 0.25) * (1 + burnBandwidth));

  return { rps, accuracy, revenuePerReq, securityPenalty, bandwidth };
}

// ─── Tick ────────────────────────────────────────────────────────────────────

const INVALID_RATIO = 0.25;

export interface TickResult {
  revenue: number;
  apiRevenue: number;
  maintenanceCost: number;
  processed: number;
  settled: number;
  rejected: number;
  missed: number;
  newCalls: ProcessedCall[];
  newEvents: FeedEvent[];
  apisCompleted: string[];
  upgradesBought: string[];
  agoraEarned: number;
}

let callCounter = 0;
let eventCounter = 0;

function makeEvent(type: FeedEvent['type'], text: string, color: string): FeedEvent {
  eventCounter++;
  return { id: `e${eventCounter}`, type, text, color, timestamp: Date.now() };
}

export function tick(state: GameState, deltaMs: number, silent = false): TickResult {
  const deltaSec = deltaMs / 1000;
  const deltaMin = deltaSec / 60;

  // ─── Process requests (existing math, unchanged) ───
  const totalRequests = state.rps * deltaSec;
  const invalidCount = totalRequests * INVALID_RATIO;
  const validCount = totalRequests - invalidCount;
  const caughtInvalids = invalidCount * state.accuracy;
  const missedInvalids = invalidCount - caughtInvalids;

  const grossRevenue = validCount * state.revenuePerReq;
  const penaltyCost = missedInvalids * state.revenuePerReq * state.securityPenalty * 5;
  let processingRevenue = Math.max(0, grossRevenue - penaltyCost);

  // Apply $AGORA staking bonus to processing revenue
  processingRevenue *= state.agoraStakeBonus;

  // ─── API revenue ───
  const scoutActive = isScoutActive(state.agents);
  let totalApiRevenue = 0;
  for (const api of state.apis) {
    if (api.status !== 'active') continue;
    const def = getApiDef(api.id);
    if (!def) continue;
    totalApiRevenue += apiRevenue(def, api.version, scoutActive) * deltaMin;
  }
  totalApiRevenue *= state.agoraStakeBonus;

  // ─── Agent maintenance ───
  const maintenancePerMin = totalMaintenance(state.agents);
  const maintenanceCost = maintenancePerMin * deltaMin;

  // ─── Agent actions + build progress ───
  const newEvents: FeedEvent[] = [];
  const apisCompleted: string[] = [];
  const upgradesBought: string[] = [];
  let agoraEarned = 0;

  // Advance build timers
  const architectActive = isArchitectActive(state.agents);
  const cpuLevel = state.upgrades['cpu'] || 0;
  for (const api of state.apis) {
    if (api.status !== 'building') continue;
    const def = getApiDef(api.id);
    if (!def) continue;
    const buildTime = effectiveBuildTime(def.buildTime, cpuLevel, architectActive);
    const progressPerSec = 1 / buildTime;
    api.buildProgress += progressPerSec * deltaSec;
    if (api.buildProgress >= 1) {
      api.buildProgress = 1;
      api.status = 'active';
      apisCompleted.push(api.id);
      agoraEarned += def.agoraBonus;
      if (!silent) {
        newEvents.push(makeEvent('api', `${def.icon} ${def.name} API deployed`, '#00ff88'));
        newEvents.push(makeEvent('fac', `+${def.agoraBonus} $AGORA`, '#ffd700'));
      }
    }
  }

  // Builder agent: start building next available API
  const builder = state.agents.find((a) => a.id === 'builder' && a.status === 'active');
  if (builder) {
    const activeCount = state.apis.filter((a) => a.status === 'active' || a.status === 'building').length;
    if (activeCount < state.apiSlots) {
      const nextApi = state.apis.find(
        (a) => a.status === 'available' && state.balance >= (getApiDef(a.id)?.buildCost ?? Infinity),
      );
      if (nextApi) {
        const def = getApiDef(nextApi.id);
        if (def) {
          nextApi.status = 'building';
          nextApi.buildProgress = 0;
          nextApi.buildStartedAt = Date.now();
          // Deduct build cost from balance will happen in the caller
          builder.currentTask = `Building ${def.name}`;
          if (!silent) {
            newEvents.push(makeEvent('agent', `\uD83D\uDD28 Builder started ${def.name}`, '#88aaff'));
          }
        }
      }
    }
  }

  // Optimizer agent: buy cheapest upgrade every ~60s (simplified: proportional to deltaMs)
  const optimizer = state.agents.find((a) => a.id === 'optimizer' && a.status === 'active');
  if (optimizer && deltaSec >= 60) {
    // Find cheapest affordable upgrade
    let cheapest: { id: string; cost: number } | null = null;
    for (const up of UPGRADES) {
      const level = state.upgrades[up.id] || 0;
      if (level >= up.maxLevel) continue;
      const cost = getUpgradeCost(up.cost, level);
      if (cost <= state.balance && (!cheapest || cost < cheapest.cost)) {
        cheapest = { id: up.id, cost };
      }
    }
    if (cheapest) {
      state.upgrades[cheapest.id] = (state.upgrades[cheapest.id] || 0) + 1;
      state.balance -= cheapest.cost;
      const upDef = UPGRADES.find((u) => u.id === cheapest!.id);
      upgradesBought.push(cheapest.id);
      optimizer.currentTask = `Upgraded ${upDef?.name || cheapest.id}`;
      if (!silent) {
        newEvents.push(makeEvent('agent', `\uD83D\uDD27 Optimizer bought ${upDef?.name || cheapest.id} LV${state.upgrades[cheapest.id]}`, '#ffaa44'));
      }
    }
  }

  // ─── Generate visible call entries ───
  const newCalls: ProcessedCall[] = [];
  if (!silent) {
    const visibleCount = Math.min(3, Math.ceil(totalRequests));
    for (let i = 0; i < visibleCount; i++) {
      const isValid = Math.random() > INVALID_RATIO;
      const isCaught = !isValid && Math.random() < state.accuracy;
      callCounter++;
      newCalls.push({
        id: `c${callCounter}`,
        amount: randomAmount(),
        valid: isValid,
        caught: isCaught,
        settled: isValid,
        timestamp: Date.now(),
      });
    }
  }

  return {
    revenue: Math.max(0, processingRevenue + totalApiRevenue - maintenanceCost),
    apiRevenue: totalApiRevenue,
    maintenanceCost,
    processed: totalRequests,
    settled: validCount,
    rejected: caughtInvalids,
    missed: missedInvalids,
    newCalls,
    newEvents,
    apisCompleted,
    upgradesBought,
    agoraEarned,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomAmount(): number {
  const amounts = [0.005, 0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.00];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

export function formatUSD(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(2) + 'K';
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

export function formatRps(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K/s';
  if (n >= 1) return n.toFixed(1) + '/s';
  return (n * 60).toFixed(0) + '/min';
}

// ─── State Persistence ───────────────────────────────────────────────────────

const SAVE_KEY = 'agora_save_v2';
const SAVE_KEY_V1 = 'agora_save_v1';
const SAVE_KEY_LEGACY = 'facilitator_save_v2';

export function saveState(state: GameState): void {
  try {
    const data = { ...state, recentCalls: [], feedEvents: [], offlineSummary: null, lastTick: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded or private browsing */ }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      // Wipe stale keys from previous versions
      try { localStorage.removeItem(SAVE_KEY_V1); } catch { /* noop */ }
      try { localStorage.removeItem(SAVE_KEY_LEGACY); } catch { /* noop */ }
      return null;
    }
    const isV1 = false;

    const data = JSON.parse(raw) as GameState;

    // Migrate v1 → v2: add new fields with defaults
    if (isV1 || !data.apis) {
      data.apis = createInitialApis();
      data.agents = createInitialAgents();
      data.apiSlots = maxApiSlots(data.tier);
      data.agentSlots = maxAgentSlots(data.tier);
      data.agoraBalance = 0;
      data.agoraTotalEarned = 0;
      data.agoraStaked = 0;
      data.agoraStakeBonus = 1.0;
      data.agoraTotalBurned = 0;
      data.agoraDailyCheckin = 0;
      data.burnBoosts = [];
      data.staking = { staked: 0, unstakingAmount: 0, unstakeAt: 0 };
      data.feedEvents = [];
      data.tutorialStep = 0; // show tutorial for migrated saves too
      data.offlineSummary = null;
      // Clean up old save key
      if (isV1) {
        try { localStorage.removeItem(SAVE_KEY_V1); } catch { /* noop */ }
      }
    }

    // Calculate offline earnings (100% efficiency, no cap)
    const offlineSec = (Date.now() - data.lastTick) / 1000;
    if (offlineSec > 10 && data.phase === 'playing') {
      const stats = computeStats(data.tier, data.upgrades, data.burnBoosts);
      data.agoraStakeBonus = getStakeBonus(data.agoraStaked);
      const offlineState = { ...data, ...stats };
      const offlineTick = tick(offlineState, offlineSec * 1000, true);

      const usdcEarned = offlineTick.revenue;
      data.balance += usdcEarned;
      data.totalEarned += usdcEarned;
      data.totalProcessed += offlineTick.processed;
      data.totalSettled += offlineTick.settled;
      data.totalRejected += offlineTick.rejected;
      data.totalMissed += offlineTick.missed;

      // $AGORA earned from agent-completed API builds
      data.agoraBalance += offlineTick.agoraEarned;
      data.agoraTotalEarned += offlineTick.agoraEarned;

      // Copy API/agent state changes from offline tick
      data.apis = offlineState.apis;
      data.agents = offlineState.agents;
      data.upgrades = offlineState.upgrades;

      // Update slots
      data.apiSlots = maxApiSlots(data.tier);
      data.agentSlots = maxAgentSlots(data.tier);
      data.apis = updateApiAvailability(data.apis, data.tier);

      // Process unstaking cooldown
      if (data.staking.unstakingAmount > 0 && Date.now() >= data.staking.unstakeAt) {
        data.agoraBalance += data.staking.unstakingAmount;
        data.staking.unstakingAmount = 0;
        data.staking.unstakeAt = 0;
      }

      data.offlineSummary = {
        durationSec: offlineSec,
        usdcEarned,
        apiRevenue: offlineTick.apiRevenue,
        maintenancePaid: offlineTick.maintenanceCost,
        apisBuilt: offlineTick.apisCompleted,
        upgradesBought: offlineTick.upgradesBought,
        agoraEarned: offlineTick.agoraEarned,
      };
    }

    data.lastTick = Date.now();
    data.recentCalls = [];
    data.feedEvents = [];
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_KEY_V1);
    localStorage.removeItem(SAVE_KEY_LEGACY);
  } catch { /* noop */ }
}

/** Strip transient fields for server persistence */
export function serializeState(state: GameState): Record<string, unknown> {
  const { recentCalls, feedEvents, offlineSummary, ...rest } = state;
  return { ...rest, lastTick: Date.now() };
}

// ─── Initial State ───────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  const stats = computeStats(0, {});
  return {
    phase: 'menu',
    balance: 0,
    totalEarned: 0,
    totalProcessed: 0,
    totalSettled: 0,
    totalRejected: 0,
    totalMissed: 0,
    tier: 0,
    upgrades: {},
    ...stats,
    apis: createInitialApis(),
    apiSlots: maxApiSlots(0),
    agents: createInitialAgents(),
    agentSlots: maxAgentSlots(0),
    agoraBalance: 0,
    agoraTotalEarned: 0,
    agoraStaked: 0,
    agoraStakeBonus: 1.0,
    agoraTotalBurned: 0,
    agoraDailyCheckin: 0,
    burnBoosts: [],
    staking: { staked: 0, unstakingAmount: 0, unstakeAt: 0 },
    recentCalls: [],
    feedEvents: [],
    callsPerSecond: 0,
    tutorialStep: 0,
    lastTick: Date.now(),
    sessionStart: Date.now(),
    totalPlayTime: 0,
    offlineSummary: null,
  };
}
