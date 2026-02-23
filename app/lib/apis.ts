// apis.ts — x402 API endpoint definitions and logic

export interface APIDefinition {
  id: string;
  name: string;
  category: string;
  icon: string;
  baseRevenue: number;   // USDC per minute
  buildCost: number;     // USDC
  buildTime: number;     // seconds
  unlockTier: number;
  agoraBonus: number;      // one-time $AGORA on deploy
}

export interface APIState {
  id: string;
  version: number;       // 1-3
  status: 'locked' | 'available' | 'building' | 'active';
  buildProgress: number; // 0-1
  buildStartedAt: number;
}

export const API_DEFINITIONS: APIDefinition[] = [
  {
    id: 'token_price',
    name: 'Token Price',
    category: 'Data',
    icon: '📊',
    baseRevenue: 0.50,
    buildCost: 100,
    buildTime: 30,
    unlockTier: 0,
    agoraBonus: 2000,
  },
  {
    id: 'signal_score',
    name: 'Signal Score',
    category: 'Analytics',
    icon: '📡',
    baseRevenue: 1.20,
    buildCost: 500,
    buildTime: 120,
    unlockTier: 1,
    agoraBonus: 2000,
  },
  {
    id: 'agent_registry',
    name: 'Agent Registry',
    category: 'Identity',
    icon: '🤖',
    baseRevenue: 2.00,
    buildCost: 2000,
    buildTime: 300,
    unlockTier: 2,
    agoraBonus: 2000,
  },
  {
    id: 'payment_router',
    name: 'Payment Router',
    category: 'Financial',
    icon: '💳',
    baseRevenue: 4.00,
    buildCost: 10000,
    buildTime: 900,
    unlockTier: 3,
    agoraBonus: 2000,
  },
  {
    id: 'curve_scanner',
    name: 'Curve Scanner',
    category: 'DeFi',
    icon: '📈',
    baseRevenue: 8.00,
    buildCost: 50000,
    buildTime: 1800,
    unlockTier: 4,
    agoraBonus: 2000,
  },
  {
    id: 'ai_orchestrator',
    name: 'AI Orchestrator',
    category: 'Compute',
    icon: '🧠',
    baseRevenue: 20.00,
    buildCost: 250000,
    buildTime: 3600,
    unlockTier: 5,
    agoraBonus: 2000,
  },
];

export function getApiDef(id: string): APIDefinition | undefined {
  return API_DEFINITIONS.find((a) => a.id === id);
}

/** Revenue per minute for a single active API at given version, with optional scout buff */
export function apiRevenue(def: APIDefinition, version: number, scoutBuff: boolean): number {
  const versionMultiplier = Math.pow(2, version - 1); // v1=1x, v2=2x, v3=4x
  const scoutMultiplier = scoutBuff ? 1.15 : 1.0;
  return def.baseRevenue * versionMultiplier * scoutMultiplier;
}

/** Effective build time in seconds, reduced by CPU level and architect buff */
export function effectiveBuildTime(
  baseBuildTime: number,
  cpuLevel: number,
  hasArchitect: boolean,
): number {
  const cpuReduction = 1 / (1 + cpuLevel * 0.10); // each CPU level = 10% faster
  const architectReduction = hasArchitect ? 0.5 : 1.0;
  return Math.max(5, baseBuildTime * cpuReduction * architectReduction);
}

/** Upgrade cost: 2x per version */
export function apiUpgradeCost(baseCost: number, version: number): number {
  return baseCost * Math.pow(2, version);
}

/** Max API slots based on tier */
export function maxApiSlots(tier: number): number {
  return tier + 1;
}

/** Create initial API states */
export function createInitialApis(): APIState[] {
  return API_DEFINITIONS.map((def) => ({
    id: def.id,
    version: 1,
    status: 'locked' as const,
    buildProgress: 0,
    buildStartedAt: 0,
  }));
}

/** Update API availability based on current tier */
export function updateApiAvailability(apis: APIState[], tier: number): APIState[] {
  return apis.map((api) => {
    const def = getApiDef(api.id);
    if (!def) return api;
    if (api.status === 'building' || api.status === 'active') return api;
    return {
      ...api,
      status: tier >= def.unlockTier ? 'available' : 'locked',
    };
  });
}
