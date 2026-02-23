// agents.ts — AI Agent definitions and tick logic

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  icon: string;
  hireCost: number;        // USDC
  maintenanceCost: number; // USDC per minute
  description: string;
}

export interface AgentState {
  id: string;
  status: 'available' | 'active' | 'idle'; // idle = paused (no funds)
  currentTask: string | null;
  taskProgress: number; // 0-1 for build tasks
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'builder',
    name: 'Builder',
    role: 'Builds APIs',
    icon: '🔨',
    hireCost: 500,
    maintenanceCost: 0.50,
    description: 'Auto-builds next available API when slot opens',
  },
  {
    id: 'optimizer',
    name: 'Optimizer',
    role: 'Upgrades',
    icon: '🔧',
    hireCost: 1000,
    maintenanceCost: 1.00,
    description: 'Auto-buys cheapest affordable upgrade every 60s',
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Discovery',
    icon: '👁',
    hireCost: 2500,
    maintenanceCost: 2.00,
    description: '+15% revenue from all APIs',
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'Meta',
    icon: '📐',
    hireCost: 10000,
    maintenanceCost: 5.00,
    description: 'Reduces all build times by 50%',
  },
];

export function getAgentDef(id: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((a) => a.id === id);
}

/** Max agent slots based on tier */
export function maxAgentSlots(tier: number): number {
  return Math.floor(tier / 2) + 1;
}

/** Total maintenance cost per minute for all active agents */
export function totalMaintenance(agents: AgentState[]): number {
  return agents.reduce((sum, agent) => {
    if (agent.status !== 'active') return sum;
    const def = getAgentDef(agent.id);
    return sum + (def?.maintenanceCost ?? 0);
  }, 0);
}

/** Check if scout is active (for API revenue buff) */
export function isScoutActive(agents: AgentState[]): boolean {
  const scout = agents.find((a) => a.id === 'scout');
  return scout?.status === 'active';
}

/** Check if architect is active (for build time reduction) */
export function isArchitectActive(agents: AgentState[]): boolean {
  const architect = agents.find((a) => a.id === 'architect');
  return architect?.status === 'active';
}

/** Create initial agent states */
export function createInitialAgents(): AgentState[] {
  return AGENT_DEFINITIONS.map((def) => ({
    id: def.id,
    status: 'available' as const,
    currentTask: null,
    taskProgress: 0,
  }));
}
