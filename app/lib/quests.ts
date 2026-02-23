// quests.ts — Quest definitions for Agora

export type QuestType = 'social' | 'milestone' | 'action';

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  reward: number; // USDC added to balance
  agoraReward?: number; // $AGORA bonus
  icon: string;
  // For social quests — what to verify
  verify?: 'follow_jumpbox' | 'share_cast' | 'add_miniapp' | 'follow_x';
  // For milestone quests — auto-complete check
  milestone?: {
    field: 'tier' | 'totalProcessed' | 'totalEarned' | 'totalPlayTime' | 'apisDeployed' | 'agentsHired' | 'agoraStaked';
    threshold: number;
  };
}

export const QUESTS: Quest[] = [
  // ─── Social Quests ──────────────────────────────────────────────────────────
  {
    id: 'share',
    name: 'BROADCAST',
    description: 'Share your progress on Farcaster',
    type: 'social',
    reward: 25,
    agoraReward: 500,
    icon: '📡',
    verify: 'share_cast',
  },
  {
    id: 'follow_jumpbox',
    name: 'FOLLOW JUMPBOX',
    description: 'Follow @jumpbox.eth on Farcaster',
    type: 'social',
    reward: 50,
    agoraReward: 500,
    icon: '👤',
    verify: 'follow_jumpbox',
  },
  {
    id: 'follow_x',
    name: 'FOLLOW ON X',
    description: 'Follow @jumpbox_tech on X',
    type: 'social',
    reward: 50,
    agoraReward: 500,
    icon: '𝕏',
    verify: 'follow_x',
  },
  {
    id: 'add_app',
    name: 'INSTALL APP',
    description: 'Add Agora to your mini apps',
    type: 'social',
    reward: 30,
    agoraReward: 500,
    icon: '📲',
    verify: 'add_miniapp',
  },

  // ─── Milestone Quests ───────────────────────────────────────────────────────
  {
    id: 'first_1k',
    name: '1K REQUESTS',
    description: 'Process 1,000 requests',
    type: 'milestone',
    reward: 15,
    agoraReward: 1000,
    icon: '🔢',
    milestone: { field: 'totalProcessed', threshold: 1000 },
  },
  {
    id: 'first_10k',
    name: '10K REQUESTS',
    description: 'Process 10,000 requests',
    type: 'milestone',
    reward: 75,
    agoraReward: 2000,
    icon: '📊',
    milestone: { field: 'totalProcessed', threshold: 10000 },
  },
  {
    id: 'first_100k',
    name: '100K REQUESTS',
    description: 'Process 100,000 requests',
    type: 'milestone',
    reward: 500,
    agoraReward: 5000,
    icon: '🏗',
    milestone: { field: 'totalProcessed', threshold: 100000 },
  },
  {
    id: 'earn_100',
    name: 'FIRST $100',
    description: 'Earn $100 total revenue',
    type: 'milestone',
    reward: 25,
    agoraReward: 1000,
    icon: '💵',
    milestone: { field: 'totalEarned', threshold: 100 },
  },
  {
    id: 'earn_10k',
    name: '$10K REVENUE',
    description: 'Earn $10,000 total revenue',
    type: 'milestone',
    reward: 250,
    agoraReward: 5000,
    icon: '💰',
    milestone: { field: 'totalEarned', threshold: 10000 },
  },
  {
    id: 'tier_cluster',
    name: 'CLUSTER',
    description: 'Upgrade to Cluster tier',
    type: 'milestone',
    reward: 25,
    agoraReward: 2000,
    icon: '🖥',
    milestone: { field: 'tier', threshold: 1 },
  },
  {
    id: 'tier_datacenter',
    name: 'DATACENTER',
    description: 'Upgrade to Datacenter tier',
    type: 'milestone',
    reward: 100,
    agoraReward: 2000,
    icon: '🏢',
    milestone: { field: 'tier', threshold: 2 },
  },
  {
    id: 'tier_national',
    name: 'NATIONAL',
    description: 'Upgrade to National tier',
    type: 'milestone',
    reward: 1000,
    agoraReward: 2000,
    icon: '🗺',
    milestone: { field: 'tier', threshold: 4 },
  },
  {
    id: 'tier_global',
    name: 'GLOBAL REACH',
    description: 'Upgrade to Global tier',
    type: 'milestone',
    reward: 10000,
    agoraReward: 2000,
    icon: '🌍',
    milestone: { field: 'tier', threshold: 6 },
  },

  // ─── New v2 Milestones ────────────────────────────────────────────────────
  {
    id: 'first_api',
    name: 'FIRST API',
    description: 'Deploy your first API endpoint',
    type: 'milestone',
    reward: 50,
    agoraReward: 2000,
    icon: '🔌',
    milestone: { field: 'apisDeployed', threshold: 1 },
  },
  {
    id: 'first_agent',
    name: 'FIRST AGENT',
    description: 'Hire your first AI agent',
    type: 'milestone',
    reward: 100,
    agoraReward: 2000,
    icon: '🤖',
    milestone: { field: 'agentsHired', threshold: 1 },
  },
  {
    id: 'all_apis',
    name: 'FULL STACK',
    description: 'Deploy all 6 API endpoints',
    type: 'milestone',
    reward: 1000,
    agoraReward: 10000,
    icon: '🏆',
    milestone: { field: 'apisDeployed', threshold: 6 },
  },
  {
    id: 'earn_100_min',
    name: '$100/MIN',
    description: 'Reach $100/min total revenue',
    type: 'milestone',
    reward: 500,
    agoraReward: 5000,
    icon: '🚀',
    milestone: { field: 'totalEarned', threshold: 50000 },
  },
  {
    id: 'stake_10m',
    name: 'STAKER',
    description: 'Stake 10M $AGORA tokens',
    type: 'milestone',
    reward: 250,
    agoraReward: 5000,
    icon: '🔒',
    milestone: { field: 'agoraStaked', threshold: 10_000_000 },
  },
];
