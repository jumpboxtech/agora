// tutorial.ts — Interactive tutorial step definitions

export interface TutorialStep {
  target: string;   // data-tutorial attribute value to highlight
  title: string;
  text: string;
  position: 'center' | 'below' | 'above'; // tooltip position relative to target
  tab?: string;     // which tab to switch to before showing this step
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: 'fullscreen',
    title: 'WELCOME',
    text: "You're building autonomous x402 payment infrastructure. Process requests, deploy APIs, hire AI agents.",
    position: 'center',
  },
  {
    target: 'canvas',
    title: 'YOUR SERVER',
    text: 'This is your processing node. It handles x402 payment requests and earns USDC.',
    position: 'below',
  },
  {
    target: 'hud-usdc',
    title: 'USDC BALANCE',
    text: 'USDC is your in-game currency. Spend it on upgrades, tiers, APIs, and agents.',
    position: 'below',
  },
  {
    target: 'hud-fac',
    title: '$AGORA TOKENS',
    text: '$AGORA is earned from actions — deploying APIs, quests, daily check-ins. Stake for boosts.',
    position: 'below',
  },
  {
    target: 'tab-feed',
    title: 'LIVE FEED',
    text: 'Watch requests flow in real-time. Green = valid (revenue), Red = caught invalid.',
    position: 'above',
    tab: 'feed',
  },
  {
    target: 'tab-infra',
    title: 'INFRASTRUCTURE',
    text: 'Upgrade CPU, filters, and bandwidth. Unlock new tiers for more throughput.',
    position: 'above',
    tab: 'infra',
  },
  {
    target: 'tab-build',
    title: 'BUILD APIs',
    text: 'Deploy x402 API endpoints for passive USDC income. Each deploy earns $AGORA.',
    position: 'above',
    tab: 'build',
  },
  {
    target: 'tab-agents',
    title: 'AI AGENTS',
    text: 'Hire agents to automate building and optimization. They work 24/7, even offline.',
    position: 'above',
    tab: 'agents',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
