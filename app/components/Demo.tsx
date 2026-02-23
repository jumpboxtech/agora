'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAccount, useConnect, useSendCalls, useCallsStatus, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, encodeFunctionData } from 'viem';
import { useAgoraStaking, formatTokenAmount, STAKE_TIERS_WEI } from '../lib/useAgoraStaking';
import { AGORA_TOKEN, AGORA_STAKING, ERC20_ABI } from '../lib/contracts';
import { useAgoraAgentSub } from '../lib/useAgoraAgentSub';
import { useAgoraRewards, type ClaimTicket } from '../lib/useAgoraRewards';
import type { FrameContext } from '../types/frame';
import {
  type GameState,
  type ProcessedCall,
  type FeedEvent,
  createInitialState,
  computeStats,
  tick,
  formatUSD,
  formatNumber,
  formatRps,
  getUpgradeCost,
  saveState,
  loadState,
  clearSave,
  serializeState,
  TIERS,
  UPGRADES,
} from '../lib/engine';
import { QUESTS, type Quest } from '../lib/quests';
import {
  type SaveItem,
  encodeSaveData,
  formatSaveItem,
  basescanTxUrl,
} from '../lib/onchain';
import { API_DEFINITIONS, getApiDef, apiRevenue, apiUpgradeCost, maxApiSlots, updateApiAvailability } from '../lib/apis';
import { AGENT_DEFINITIONS, getAgentDef, totalMaintenance, isScoutActive, maxAgentSlots } from '../lib/agents';
import { getStakeLabel, BURN_BOOSTS } from '../lib/staking';
import { AGORA_REWARDS, formatAgora, canDailyCheckin } from '../lib/agora-token';
import { TOTAL_STEPS } from '../lib/tutorial';
import TutorialOverlay from './TutorialOverlay';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

// ─── Sub-components ──────────────────────────────────────────────────────────

function CallFeed({ calls, events }: { calls: ProcessedCall[]; events: FeedEvent[] }) {
  return (
    <div className="space-y-0.5 overflow-hidden max-h-[120px]">
      {events.slice(0, 5).map(e => (
        <div key={e.id} className="flex items-center gap-1.5 text-[9px] font-mono animate-slide-in">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
          <span style={{ color: e.color + 'aa' }}>{e.text}</span>
        </div>
      ))}
      {calls.map(c => (
        <div key={c.id} className="flex items-center gap-1.5 text-[9px] font-mono animate-slide-in">
          <div className={`w-1.5 h-1.5 rounded-full ${c.valid ? 'bg-accent' : c.caught ? 'bg-warn' : 'bg-danger'}`} />
          <span className="text-white/30">{formatUSD(c.amount)}</span>
          <span className={c.valid ? 'text-accent/60' : c.caught ? 'text-warn/60' : 'text-danger/60'}>
            {c.valid ? 'SETTLED' : c.caught ? 'REJECTED' : 'MISSED'}
          </span>
        </div>
      ))}
    </div>
  );
}

function UpgradeButton({
  id, name, icon, description, level, maxLevel, cost, canAfford, onBuy,
}: {
  id: string; name: string; icon: string; description: string;
  level: number; maxLevel: number; cost: number; canAfford: boolean; onBuy: (id: string) => void;
}) {
  const maxed = level >= maxLevel;
  return (
    <button
      onClick={() => !maxed && canAfford && onBuy(id)}
      disabled={maxed || !canAfford}
      className={`w-full text-left p-2 rounded-lg border transition-all ${
        maxed ? 'bg-white/3 border-white/5 opacity-40'
          : canAfford ? 'bg-surface-card border-accent/20 hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98]'
            : 'bg-surface-card border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-[10px] font-bold text-white/80">{name}</span>
        </div>
        <span className="text-[8px] font-mono text-white/30">LV {level}/{maxLevel}</span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[8px] text-white/30">{description}</span>
        {!maxed && <span className={`text-[9px] font-mono ${canAfford ? 'text-accent' : 'text-white/20'}`}>{formatUSD(cost)}</span>}
      </div>
    </button>
  );
}

function QuestCard({
  quest, completed, claiming, canClaim, onClaim,
}: {
  quest: Quest; completed: boolean; claiming: boolean; canClaim: boolean; onClaim: (id: string) => void;
}) {
  return (
    <div className={`p-2 rounded-lg border transition-all ${
      completed ? 'bg-accent/5 border-accent/20 opacity-60'
        : canClaim ? 'bg-surface-card border-warn/30' : 'bg-surface-card border-white/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{quest.icon}</span>
          <div>
            <span className={`text-[10px] font-bold ${completed ? 'text-accent/60' : 'text-white/80'}`}>{quest.name}</span>
            <div className="text-[8px] text-white/30">{quest.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {completed ? (
            <span className="text-[8px] font-mono text-accent tracking-wider">DONE</span>
          ) : (
            <>
              <div className="text-right">
                <span className="text-[9px] font-mono text-warn block">+{formatUSD(quest.reward)}</span>
                {quest.agoraReward && <span className="text-[8px] font-mono text-yellow-400/60">+{formatAgora(quest.agoraReward)} $AGORA</span>}
              </div>
              <button
                onClick={() => onClaim(quest.id)}
                disabled={claiming || (!canClaim && quest.type === 'milestone')}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  claiming ? 'bg-white/5 text-white/20 animate-pulse'
                    : canClaim || quest.type === 'social' ? 'bg-accent text-surface hover:shadow-accent/20 hover:shadow-lg active:scale-95'
                      : 'bg-white/5 text-white/20'
                }`}
              >
                {claiming ? '...' : quest.type === 'social' ? 'GO' : 'CLAIM'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type TabId = 'feed' | 'build' | 'agents' | 'infra' | 'quests' | 'about';

export default function Demo() {
  const [frameData, setFrameData] = useState<FrameContext | null>(null);
  const [game, setGame] = useState<GameState>(() => {
    if (typeof window === 'undefined') return createInitialState();
    return loadState() || createInitialState();
  });
  const [tab, setTab] = useState<TabId>('feed');
  const [tierUnlock, setTierUnlock] = useState<number | null>(null);
  const [completedQuests, setCompletedQuests] = useState<Set<string>>(new Set());
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null);
  const [questReward, setQuestReward] = useState<{ id: string; amount: number } | null>(null);
  const [saveQueue, setSaveQueue] = useState<SaveItem[]>([]);
  const [lastSaveTx, setLastSaveTx] = useState<string | null>(null);
  const [showOfflineSummary, setShowOfflineSummary] = useState<boolean>(!!game.offlineSummary);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickTime = useRef(Date.now());
  const pendingApiClaims = useRef<string[]>([]);
  const pendingAgoraAmount = useRef(0);
  const questsFetched = useRef(false);
  const gameRef = useRef<GameState>(game);
  const pendingStakeRef = useRef<bigint>(BigInt(0));
  const serverSynced = useRef(false);
  const serverSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep gameRef in sync for Pixi canvas
  useEffect(() => { gameRef.current = game; }, [game]);

  // ─── Wagmi ───────────────────────────────────────────────────────────────────
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { sendCalls, data: saveCallsResult, isPending: isSaveSending, isError: isSaveError, reset: resetSaveCalls } = useSendCalls();
  const saveCallsId = saveCallsResult?.id;
  const { data: saveCallsStatus } = useCallsStatus({ id: saveCallsId as string, query: { enabled: !!saveCallsId, refetchInterval: 2000 } });

  // On-chain contract hooks
  const chainStake = useAgoraStaking(address as `0x${string}` | undefined);
  const chainSub = useAgoraAgentSub(address as `0x${string}` | undefined);
  const chainRewards = useAgoraRewards(address as `0x${string}` | undefined);
  const [stakingAction, setStakingAction] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState('');
  const [claimingReward, setClaimingReward] = useState(false);

  // Burn-to-boost (real ERC20 transfer to dead address)
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;
  const { writeContract: writeBurn, data: burnTxHash, isPending: isBurning, reset: resetBurn } = useWriteContract();
  const { isLoading: isBurnConfirming, isSuccess: isBurnConfirmed } = useWaitForTransactionReceipt({ hash: burnTxHash });
  const [pendingBurnBoost, setPendingBurnBoost] = useState<string | null>(null);

  // Init Farcaster SDK
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        if (typeof window !== 'undefined' && window.frame?.sdk) {
          window.frame.sdk.actions.ready();
          const ctx = await window.frame.sdk.context;
          if (mounted) setFrameData(ctx);

          // Auto-prompt addMiniApp if not already added (captures notification token via Neynar)
          if (!ctx?.client?.added) {
            try { await window.frame.sdk.actions.addMiniApp(); } catch {}
          }

          // Wait for Neynar webhook to process the token before registering
          if (ctx?.user?.fid) {
            setTimeout(() => {
              fetch('/api/notifications/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fid: ctx.user.fid }),
              }).catch(() => {});
            }, 3000);
          }
        }
      } catch { /* browser mode */ }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Auto-connect Farcaster wallet
  useEffect(() => {
    if (!isConnected && connectors.length > 0) connect({ connector: connectors[0] });
  }, [isConnected, connectors, connect]);

  // Load state from server on init, then layer localStorage on top (favor local progress)
  useEffect(() => {
    if (!frameData?.user?.fid || serverSynced.current) return;
    serverSynced.current = true;

    fetch(`/api/state?fid=${frameData.user.fid}`)
      .then(r => r.json())
      .then(data => {
        if (!data.state) return; // No server save — keep local as-is
        const srv = typeof data.state === 'string' ? JSON.parse(data.state) : data.state;
        if (!srv || !srv.totalPlayTime) return;

        setGame(local => {
          // If local has no real progress, just use server state
          if (!local.totalPlayTime) {
            return { ...srv, recentCalls: [], feedEvents: [], offlineSummary: null, lastTick: Date.now(), sessionStart: Date.now() };
          }

          // Start from server, layer local on top — favor whichever is more progressed per field
          const apiRank = { locked: 0, available: 1, building: 2, active: 3 } as const;
          const agentRank = { available: 0, idle: 1, active: 2 } as const;

          // Merge APIs: per-id, take more progressed status
          const mergedApis = (srv.apis || []).map((sApi: typeof local.apis[number]) => {
            const lApi = local.apis?.find((a: typeof sApi) => a.id === sApi.id);
            if (!lApi) return sApi;
            const sR = apiRank[sApi.status] ?? 0;
            const lR = apiRank[lApi.status] ?? 0;
            if (lR > sR) return lApi;
            if (lR === sR && (lApi.buildProgress ?? 0) > (sApi.buildProgress ?? 0)) return lApi;
            return sApi;
          });

          // Merge agents: per-id, take more progressed status
          const mergedAgents = (srv.agents || []).map((sAg: typeof local.agents[number]) => {
            const lAg = local.agents?.find((a: typeof sAg) => a.id === sAg.id);
            if (!lAg) return sAg;
            const sR = agentRank[sAg.status] ?? 0;
            const lR = agentRank[lAg.status] ?? 0;
            return lR >= sR ? lAg : sAg;
          });

          // Merge upgrades: take max level per key
          const mergedUpgrades: Record<string, number> = { ...(srv.upgrades || {}) };
          for (const [k, v] of Object.entries(local.upgrades || {})) {
            mergedUpgrades[k] = Math.max(mergedUpgrades[k] ?? 0, v as number);
          }

          // Merge burn boosts: union
          const mergedBurns = [...new Set([...(srv.burnBoosts || []), ...(local.burnBoosts || [])])];

          // Tutorial: -1 means completed (best), otherwise higher = further
          const mergedTutorial = local.tutorialStep === -1 || srv.tutorialStep === -1
            ? -1
            : Math.max(local.tutorialStep ?? 0, srv.tutorialStep ?? 0);

          return {
            ...srv,
            // Numeric progression — take max
            balance: Math.max(local.balance ?? 0, srv.balance ?? 0),
            totalEarned: Math.max(local.totalEarned ?? 0, srv.totalEarned ?? 0),
            totalProcessed: Math.max(local.totalProcessed ?? 0, srv.totalProcessed ?? 0),
            totalSettled: Math.max(local.totalSettled ?? 0, srv.totalSettled ?? 0),
            totalRejected: Math.max(local.totalRejected ?? 0, srv.totalRejected ?? 0),
            totalMissed: Math.max(local.totalMissed ?? 0, srv.totalMissed ?? 0),
            tier: Math.max(local.tier ?? 0, srv.tier ?? 0),
            agoraBalance: Math.max(local.agoraBalance ?? 0, srv.agoraBalance ?? 0),
            agoraTotalEarned: Math.max(local.agoraTotalEarned ?? 0, srv.agoraTotalEarned ?? 0),
            agoraStaked: Math.max(local.agoraStaked ?? 0, srv.agoraStaked ?? 0),
            agoraStakeBonus: Math.max(local.agoraStakeBonus ?? 0, srv.agoraStakeBonus ?? 0),
            agoraTotalBurned: Math.max(local.agoraTotalBurned ?? 0, srv.agoraTotalBurned ?? 0),
            totalPlayTime: Math.max(local.totalPlayTime ?? 0, srv.totalPlayTime ?? 0),
            apiSlots: Math.max(local.apiSlots ?? 1, srv.apiSlots ?? 1),
            agentSlots: Math.max(local.agentSlots ?? 1, srv.agentSlots ?? 1),
            // Daily checkin — most recent timestamp
            agoraDailyCheckin: Math.max(local.agoraDailyCheckin ?? 0, srv.agoraDailyCheckin ?? 0),
            // Merged collections
            apis: mergedApis,
            agents: mergedAgents,
            upgrades: mergedUpgrades,
            burnBoosts: mergedBurns,
            tutorialStep: mergedTutorial,
            // Staking — take whichever has more staked
            staking: (local.staking?.staked ?? 0) >= (srv.staking?.staked ?? 0) ? (local.staking ?? srv.staking) : srv.staking,
            // Phase: if local is playing, keep playing
            phase: local.phase === 'playing' ? 'playing' : srv.phase,
            // Transient fields — always reset
            recentCalls: [],
            feedEvents: [],
            offlineSummary: null,
            lastTick: Date.now(),
            sessionStart: Date.now(),
          };
        });
      })
      .catch(() => { /* server unavailable, continue with local state */ });
  }, [frameData]);

  // Periodic server save (every 30s when playing)
  useEffect(() => {
    const fid = frameData?.user?.fid;
    if (game.phase !== 'playing' || !fid) {
      if (serverSaveRef.current) clearInterval(serverSaveRef.current);
      return;
    }
    serverSaveRef.current = setInterval(() => {
      const state = gameRef.current;
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, state: serializeState(state) }),
      }).catch(() => { /* silent fail */ });
    }, 30_000);
    return () => { if (serverSaveRef.current) clearInterval(serverSaveRef.current); };
  }, [game.phase, frameData]);

  // Sync on-chain staking bonus with game state
  useEffect(() => {
    if (chainStake.onChainTier > 0) {
      const bonus = 1 + Number(chainStake.bonusBps) / 10000;
      setGame(prev => prev.agoraStakeBonus !== bonus ? { ...prev, agoraStakeBonus: bonus } : prev);
    }
  }, [chainStake.bonusBps, chainStake.onChainTier]);

  // Refetch after staking tx confirms — auto-chain approve → stake
  useEffect(() => {
    if (chainStake.isConfirmed && stakingAction) {
      if (stakingAction === 'approve' && pendingStakeRef.current > BigInt(0)) {
        // Approval confirmed — now auto-trigger the stake tx
        const amount = pendingStakeRef.current;
        pendingStakeRef.current = BigInt(0);
        chainStake.refetchAll();
        chainStake.reset();
        setStakingAction('stake');
        // Small delay to let reset take effect before new writeContract
        setTimeout(() => chainStake.stake(amount), 200);
      } else {
        // Stake / unstake / claim confirmed
        chainStake.refetchAll();
        chainStake.reset();
        setStakingAction(null);
      }
    }
  }, [chainStake.isConfirmed, stakingAction]);

  // Refetch after subscription tx confirms
  useEffect(() => {
    if (chainSub.isConfirmed) {
      chainSub.refetchAll();
      chainSub.reset();
    }
  }, [chainSub.isConfirmed]);

  // Apply $AGORA balance only after on-chain claim tx confirms
  useEffect(() => {
    if (chainRewards.isConfirmed) {
      if (pendingAgoraAmount.current > 0) {
        const amount = pendingAgoraAmount.current;
        setGame(prev => ({
          ...prev,
          agoraBalance: prev.agoraBalance + amount,
          agoraTotalEarned: prev.agoraTotalEarned + amount,
        }));
        pendingAgoraAmount.current = 0;
      }
      chainRewards.refetchClaimed();
      chainRewards.reset();
      setClaimingReward(false);
    }
  }, [chainRewards.isConfirmed]);

  // Reset on wallet rejection or tx failure — unblock future claims
  useEffect(() => {
    if (chainRewards.isWriteError) {
      setClaimingReward(false);
      pendingAgoraAmount.current = 0;
      chainRewards.reset();
    }
  }, [chainRewards.isWriteError]);

  // Handle burn-to-boost tx confirmation
  useEffect(() => {
    if (isBurnConfirmed && pendingBurnBoost) {
      const boost = BURN_BOOSTS.find(b => b.id === pendingBurnBoost);
      if (boost) {
        setGame(prev => {
          if (prev.burnBoosts.includes(pendingBurnBoost)) return prev;
          const newBurnBoosts = [...prev.burnBoosts, pendingBurnBoost];
          const stats = computeStats(prev.tier, prev.upgrades, newBurnBoosts);
          return { ...prev, burnBoosts: newBurnBoosts, ...stats };
        });
      }
      setPendingBurnBoost(null);
      resetBurn();
      chainStake.refetchAll();
    }
  }, [isBurnConfirmed, pendingBurnBoost]);

  // Request a signed reward ticket from the server and submit the claim tx
  const claimReward = useCallback(async (action: string, questId?: string, agoraAmount?: number) => {
    if (!address || !frameData?.user?.fid || claimingReward) return;
    setClaimingReward(true);
    if (agoraAmount) pendingAgoraAmount.current = agoraAmount;
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, action, fid: frameData.user.fid, ...(questId && { questId }) }),
      });
      const data = await res.json();
      if (data.error) { setClaimingReward(false); pendingAgoraAmount.current = 0; return; }
      const ticket: ClaimTicket = {
        amount: BigInt(data.ticket.amount),
        nonce: BigInt(data.ticket.nonce),
        signature: data.ticket.signature as `0x${string}`,
      };
      chainRewards.claim(ticket);
    } catch {
      setClaimingReward(false);
      pendingAgoraAmount.current = 0;
    }
  }, [address, frameData, claimingReward, chainRewards]);

  // Fetch completed quests
  useEffect(() => {
    if (!frameData?.user?.fid || questsFetched.current) return;
    questsFetched.current = true;
    fetch(`/api/quests?fid=${frameData.user.fid}`)
      .then(r => r.json())
      .then(data => { if (data.completed) setCompletedQuests(new Set(data.completed)); })
      .catch(() => {});
  }, [frameData]);

  // $AGORA balance is updated ONLY when on-chain claim tx confirms (see isConfirmed effect)

  // ─── Send notification (fire-and-forget via /trigger — no auth needed) ───────
  const sendNotification = useCallback((category: string, title: string, body: string, eventId: string) => {
    const fid = frameData?.user?.fid;
    if (!fid) return;
    fetch('/api/notifications/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fid, category, title, body, event_id: eventId }),
    }).catch(() => {});
  }, [frameData]);

  // ─── Game Tick ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (game.phase !== 'playing') {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    lastTickTime.current = Date.now();
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickTime.current;
      lastTickTime.current = now;

      setGame(prev => {
        if (prev.phase !== 'playing') return prev;
        const result = tick(prev, delta);
        // Queue on-chain claims for completed API builds
        if (result.apisCompleted.length > 0) {
          pendingApiClaims.current.push(...result.apisCompleted);
        }
        return {
          ...prev,
          balance: prev.balance + result.revenue,
          totalEarned: prev.totalEarned + Math.max(0, result.revenue),
          totalProcessed: prev.totalProcessed + result.processed,
          totalSettled: prev.totalSettled + result.settled,
          totalRejected: prev.totalRejected + result.rejected,
          totalMissed: prev.totalMissed + result.missed,
          // agoraBalance updated on-chain via deploy_api claim confirmation
          recentCalls: [...result.newCalls, ...prev.recentCalls].slice(0, 15),
          feedEvents: [...result.newEvents, ...prev.feedEvents].slice(0, 20),
          callsPerSecond: prev.rps,
          totalPlayTime: prev.totalPlayTime + delta / 1000,
          lastTick: now,
        };
      });
    }, 200);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [game.phase]);

  // Claim on-chain rewards for completed API builds
  useEffect(() => {
    if (game.phase !== 'playing') return;
    const drainInterval = setInterval(() => {
      if (pendingApiClaims.current.length > 0) {
        pendingApiClaims.current = [];
        claimReward('deploy_api', undefined, AGORA_REWARDS.deployApi);
      }
    }, 2000);
    return () => clearInterval(drainInterval);
  }, [game.phase, claimReward]);

  // Auto-save (localStorage every 10s)
  useEffect(() => {
    if (game.phase !== 'playing') return;
    saveRef.current = setInterval(() => setGame(prev => { saveState(prev); return prev; }), 10000);
    return () => { if (saveRef.current) clearInterval(saveRef.current); };
  }, [game.phase]);

  // Queue on-chain save
  const queueSave = useCallback((item: SaveItem) => setSaveQueue(prev => [...prev, item]), []);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const buyUpgrade = useCallback((upgradeId: string) => {
    setGame(prev => {
      const upg = UPGRADES.find(u => u.id === upgradeId);
      if (!upg) return prev;
      const level = prev.upgrades[upgradeId] || 0;
      if (level >= upg.maxLevel) return prev;
      const cost = getUpgradeCost(upg.cost, level);
      if (prev.balance < cost) return prev;
      const newUpgrades = { ...prev.upgrades, [upgradeId]: level + 1 };
      const stats = computeStats(prev.tier, newUpgrades, prev.burnBoosts);
      return { ...prev, balance: prev.balance - cost, upgrades: newUpgrades, ...stats };
    });
  }, []);

  const buyTier = useCallback((tierId: number) => {
    const prev = gameRef.current;
    if (tierId !== prev.tier + 1) return;
    const t = TIERS[tierId];
    if (!t || prev.balance < t.cost) return;

    setGame(prev => {
      if (tierId !== prev.tier + 1) return prev;
      if (!t || prev.balance < t.cost) return prev;
      const stats = computeStats(tierId, prev.upgrades, prev.burnBoosts);
      const apis = updateApiAvailability(prev.apis, tierId);
      setTierUnlock(tierId);
      setTimeout(() => setTierUnlock(null), 3000);
      queueSave({ type: 'tier', tier: tierId, name: t.name });
      return {
        ...prev, balance: prev.balance - t.cost, tier: tierId, ...stats,
        apis, apiSlots: maxApiSlots(tierId), agentSlots: maxAgentSlots(tierId),
      };
    });
    claimReward('upgrade_tier', undefined, AGORA_REWARDS.upgradeTier);
    sendNotification('progress', 'Tier Unlocked!', `You reached ${t.name}. New APIs available!`, `tier-${tierId}-${frameData?.user?.fid}`);
  }, [queueSave, claimReward, sendNotification, frameData]);

  const deployApi = useCallback((apiId: string) => {
    setGame(prev => {
      const def = getApiDef(apiId);
      if (!def) return prev;
      const api = prev.apis.find(a => a.id === apiId);
      if (!api || api.status !== 'available') return prev;
      if (prev.balance < def.buildCost) return prev;
      const activeCount = prev.apis.filter(a => a.status === 'active' || a.status === 'building').length;
      if (activeCount >= prev.apiSlots) return prev;

      const newApis = prev.apis.map(a =>
        a.id === apiId ? { ...a, status: 'building' as const, buildProgress: 0, buildStartedAt: Date.now() } : a
      );
      return { ...prev, balance: prev.balance - def.buildCost, apis: newApis };
    });
  }, []);

  const upgradeApi = useCallback((apiId: string) => {
    setGame(prev => {
      const def = getApiDef(apiId);
      const api = prev.apis.find(a => a.id === apiId);
      if (!def || !api || api.status !== 'active' || api.version >= 3) return prev;
      const cost = apiUpgradeCost(def.buildCost, api.version);
      if (prev.balance < cost) return prev;
      const newApis = prev.apis.map(a => a.id === apiId ? { ...a, version: a.version + 1 } : a);
      return { ...prev, balance: prev.balance - cost, apis: newApis };
    });
  }, []);

  const hireAgent = useCallback((agentId: string) => {
    setGame(prev => {
      const def = getAgentDef(agentId);
      const agent = prev.agents.find(a => a.id === agentId);
      if (!def || !agent || agent.status !== 'available') return prev;
      if (prev.balance < def.hireCost) return prev;
      const activeCount = prev.agents.filter(a => a.status === 'active').length;
      if (activeCount >= prev.agentSlots) return prev;
      const newAgents = prev.agents.map(a => a.id === agentId ? { ...a, status: 'active' as const } : a);
      return { ...prev, balance: prev.balance - def.hireCost, agents: newAgents };
    });
  }, []);

  const fireAgent = useCallback((agentId: string) => {
    setGame(prev => {
      const newAgents = prev.agents.map(a =>
        a.id === agentId ? { ...a, status: 'available' as const, currentTask: null } : a
      );
      return { ...prev, agents: newAgents };
    });
  }, []);

  // On-chain staking replaces in-game dummy staking (see chainStake hook)

  // Burn-to-boost: real ERC20 transfer to dead address
  const burnForBoost = useCallback((boostId: string) => {
    const boost = BURN_BOOSTS.find(b => b.id === boostId);
    if (!boost || game.burnBoosts.includes(boostId)) return;
    const costWei = parseEther(String(boost.cost));
    if (chainStake.balance < costWei) return;
    setPendingBurnBoost(boostId);
    writeBurn({
      address: AGORA_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [DEAD_ADDRESS, costWei],
    });
  }, [game.burnBoosts, chainStake.balance, writeBurn]);

  const dailyCheckin = useCallback(() => {
    const prev = gameRef.current;
    if (!canDailyCheckin(prev.agoraDailyCheckin)) return;

    setGame(prev => {
      if (!canDailyCheckin(prev.agoraDailyCheckin)) return prev;
      return { ...prev, agoraDailyCheckin: Date.now() };
    });
    claimReward('daily_checkin', undefined, AGORA_REWARDS.dailyCheckin);
  }, [claimReward]);

  // Tutorial
  const advanceTutorial = useCallback(() => {
    const prev = gameRef.current;
    const isCompleting = prev.tutorialStep + 1 >= TOTAL_STEPS;

    setGame(prev => {
      const next = prev.tutorialStep + 1;
      if (next >= TOTAL_STEPS) return { ...prev, tutorialStep: -1 };
      return { ...prev, tutorialStep: next };
    });

    if (isCompleting) claimReward('tutorial_complete', undefined, AGORA_REWARDS.completeTutorial);
  }, [claimReward]);

  const skipTutorial = useCallback(() => {
    setGame(prev => ({ ...prev, tutorialStep: -1 }));
  }, []);

  const replayTutorial = useCallback(() => {
    setGame(prev => ({ ...prev, tutorialStep: 0 }));
  }, []);

  const startGame = useCallback(() => {
    setGame(prev => {
      const stats = computeStats(prev.tier, prev.upgrades, prev.burnBoosts);
      const apis = updateApiAvailability(prev.apis, prev.tier);
      return { ...prev, phase: 'playing', sessionStart: Date.now(), lastTick: Date.now(), apis, ...stats };
    });
  }, []);

  // On-chain save — batched via EIP-5792 (single wallet prompt)
  const isSaving = isSaveSending || (!!saveCallsId && saveCallsStatus?.status === 'pending');
  const saveOnChain = useCallback(() => {
    if (!isConnected || !address || isSaveSending || saveQueue.length === 0) return;
    const fid = frameData?.user?.fid || 0;
    const saveData = encodeSaveData({
      fid,
      tier: game.tier,
      totalProcessed: game.totalProcessed,
      totalEarned: game.totalEarned,
      completedQuests: [...completedQuests],
      apisDeployed: game.apis.filter((a) => a.status === 'active').length,
      agentsHired: game.agents.filter((a) => a.status === 'active').length,
      agoraEarned: game.agoraTotalEarned,
      agoraStaked: game.agoraStaked,
      agoraBurned: game.agoraTotalBurned,
      burnBoosts: game.burnBoosts,
    });
    // Save costs 500 $AGORA — transferred to staking contract
    const saveFee = AGORA_REWARDS.onChainSave;
    if (game.agoraBalance < saveFee) return;

    setGame(prev => ({
      ...prev,
      agoraBalance: prev.agoraBalance - saveFee,
    }));

    // Batch: save data self-send + $AGORA fee transfer in one wallet prompt
    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [AGORA_STAKING as `0x${string}`, parseEther(String(saveFee))],
    });

    sendCalls({
      calls: [
        { to: address, value: BigInt(0), data: saveData },
        { to: AGORA_TOKEN as `0x${string}`, data: transferCalldata },
      ],
    });
  }, [isConnected, address, isSaveSending, saveQueue, frameData, game.tier, game.totalProcessed, game.totalEarned, completedQuests, sendCalls]);

  // Track save batch confirmation
  useEffect(() => {
    if (saveCallsStatus?.status === 'success' && saveCallsId) {
      // Extract tx hash from first receipt for VIEW TX link
      const receipts = (saveCallsStatus as { receipts?: { transactionHash: `0x${string}` }[] }).receipts;
      if (receipts?.[0]?.transactionHash) setLastSaveTx(receipts[0].transactionHash);
      setSaveQueue([]);
      resetSaveCalls();
    }
  }, [saveCallsStatus, saveCallsId, resetSaveCalls]);

  // Reset on save rejection
  useEffect(() => {
    if (isSaveError) {
      // Refund the deducted fee
      setGame(prev => ({
        ...prev,
        agoraBalance: prev.agoraBalance + AGORA_REWARDS.onChainSave,
      }));
      resetSaveCalls();
    }
  }, [isSaveError, resetSaveCalls]);

  // Quest claiming
  const JUMPBOX_FID = 842363;
  const claimQuest = useCallback(async (questId: string) => {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest || completedQuests.has(questId)) return;
    const sdk = window.frame?.sdk;
    setClaimingQuest(questId);

    if (quest.type === 'social' && quest.verify) {
      try {
        switch (quest.verify) {
          case 'share_cast': {
            if (!sdk) { setClaimingQuest(null); return; }
            const statsParams = new URLSearchParams({
              tier: String(game.tier),
              earned: String(Math.floor(game.totalEarned * 100) / 100),
              apis: String(game.apis.filter(a => a.status === 'active').length),
              agents: String(game.agents.filter(a => a.status === 'active').length),
              agora: String(Math.floor(game.agoraTotalEarned)),
              processed: String(game.totalProcessed),
            });
            const result = await sdk.actions.composeCast({ message: `Building my x402 infrastructure empire in Agora — ${TIERS[game.tier]?.name} tier, ${formatUSD(game.totalEarned)} earned.`, embeds: [`https://agora.jumpbox.tech?${statsParams}`] });
            // User cancelled — don't reward
            if (!result?.cast) { setClaimingQuest(null); return; }
            break;
          }
          case 'follow_jumpbox':
            if (sdk) await sdk.actions.viewProfile({ fid: JUMPBOX_FID });
            break;
          case 'follow_x':
            if (sdk) sdk.actions.openUrl('https://x.com/jumpbox_tech');
            break;
          case 'add_miniapp':
            if (sdk) try { await sdk.actions.addMiniApp(); } catch {}
            break;
        }
      } catch { setClaimingQuest(null); return; }
      if (quest.verify === 'follow_jumpbox') await new Promise(r => setTimeout(r, 3000));
      if (quest.verify === 'follow_x') await new Promise(r => setTimeout(r, 5000));
    }

    const fid = frameData?.user?.fid;
    const doComplete = (reward: number) => {
      setCompletedQuests(prev => new Set([...prev, questId]));
      if (reward > 0) {
        setGame(prev => ({ ...prev, balance: prev.balance + reward }));
        setQuestReward({ id: questId, amount: reward });
        setTimeout(() => setQuestReward(null), 2000);
        queueSave({ type: 'quest', questId, reward });
      }
      if (quest.agoraReward) {
        claimReward('complete_quest', questId, quest.agoraReward);
      }
      sendNotification('rewards', 'Quest Complete', `${quest.name} — earned ${formatUSD(reward)}`, `quest-${questId}-${fid}`);
    };

    if (fid) {
      try {
        const res = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fid, questId, gameState: { tier: game.tier, totalProcessed: game.totalProcessed, totalEarned: game.totalEarned, totalPlayTime: game.totalPlayTime, apisDeployed: game.apis.filter(a => a.status === 'active').length, agentsHired: game.agents.filter(a => a.status === 'active').length, agoraStaked: game.agoraStaked } }) });
        const data = await res.json();
        if (data.success || data.error === 'already completed') doComplete(data.reward || 0);
      } catch {
        // Only auto-reward on network error for non-verified quests
        if (!quest.verify) doComplete(quest.reward);
      }
    } else if (!quest.verify) { doComplete(quest.reward); }
    setClaimingQuest(null);
  }, [completedQuests, frameData, game.tier, game.totalProcessed, game.totalEarned, game.totalPlayTime, queueSave, claimReward, sendNotification]);

  const isMilestoneReady = useCallback((quest: Quest): boolean => {
    if (!quest.milestone) return false;
    const { field, threshold } = quest.milestone;
    let val: number;
    switch (field) {
      case 'apisDeployed':
        val = game.apis.filter(a => a.status === 'active').length;
        break;
      case 'agentsHired':
        val = game.agents.filter(a => a.status === 'active').length;
        break;
      case 'agoraStaked':
        val = game.agoraStaked;
        break;
      default:
        val = game[field as keyof GameState] as number;
    }
    return val >= threshold;
  }, [game]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const currentTier = TIERS[game.tier] || TIERS[0];
  const accuracyPct = Math.floor(game.accuracy * 100);
  const activeApis = game.apis.filter(a => a.status === 'active').length;
  const buildingApis = game.apis.filter(a => a.status === 'building').length;
  const activeAgents = game.agents.filter(a => a.status === 'active').length;
  const scoutActive = isScoutActive(game.agents);
  const apiRevenuePerMin = game.apis.reduce((sum, a) => {
    if (a.status !== 'active') return sum;
    const def = getApiDef(a.id);
    return def ? sum + apiRevenue(def, a.version, scoutActive) : sum;
  }, 0) * game.agoraStakeBonus;
  const maintenancePerMin = totalMaintenance(game.agents);
  const stakeLabel = getStakeLabel(game.agoraStaked);
  const canCheckin = canDailyCheckin(game.agoraDailyCheckin);

  // ─── Menu Screen ──────────────────────────────────────────────────────────
  if (game.phase === 'menu') {
    const hasSave = typeof window !== 'undefined' && !!loadState();
    return (
      <div className="h-[100dvh] w-full bg-surface bg-grid flex flex-col items-center justify-center relative overflow-hidden">
        <div className="scanline" /><div className="noise" />
        <div className="relative z-10 flex flex-col items-center gap-4 px-5 text-center">
          <div className="relative">
            <div className="text-[9px] font-mono tracking-[0.3em] text-accent/60 mb-1">x402 PROTOCOL</div>
            <h1 className="text-4xl font-bold tracking-tight text-white animate-glitch">AGORA</h1>
            <div className="text-xs text-white/40 mt-2 font-light tracking-wide">Payment Infrastructure Tycoon</div>
          </div>
          <p className="text-[11px] text-white/40 max-w-[300px] leading-relaxed">
            Build an x402 payment processing empire. Deploy APIs. Hire AI agents. Earn $AGORA.
          </p>
          {frameData?.user && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
              {frameData.user.pfpUrl && <img src={frameData.user.pfpUrl} alt="" className="w-7 h-7 rounded-full" />}
              <span className="text-xs text-white/70">@{frameData.user.username}</span>
            </div>
          )}
          <button onClick={startGame} className="btn-approve px-8 py-3 text-base tracking-wide mt-1">
            {hasSave ? 'RESUME' : 'BOOT SERVER'}
          </button>
          {hasSave && (
            <button onClick={() => { clearSave(); setGame(createInitialState()); }} className="text-[10px] text-white/20 hover:text-danger transition-colors">
              WIPE &amp; RESTART
            </button>
          )}
          <div className="text-[9px] text-white/15 font-mono mt-1">
            7 TIERS &middot; 6 APIs &middot; 4 AGENTS &middot; $AGORA TOKEN &middot; IDLE EARNINGS
          </div>
        </div>
      </div>
    );
  }

  // ─── Welcome Back Modal ───────────────────────────────────────────────────
  if (showOfflineSummary && game.offlineSummary) {
    const s = game.offlineSummary;
    const hours = Math.floor(s.durationSec / 3600);
    const mins = Math.floor((s.durationSec % 3600) / 60);
    return (
      <div className="h-[100dvh] w-full bg-surface flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm p-5 rounded-xl bg-black/60 border border-accent/30">
          <div className="text-[9px] font-mono text-accent/60 tracking-widest mb-1">WELCOME BACK</div>
          <div className="text-xs text-white/40 mb-3">Your infrastructure ran for {hours > 0 ? `${hours}h ` : ''}{mins}m autonomously</div>
          <div className="space-y-1.5 text-[10px] font-mono">
            <div className="flex justify-between"><span className="text-white/40">USDC earned</span><span className="text-accent">{formatUSD(s.usdcEarned)}</span></div>
            <div className="flex justify-between"><span className="text-white/40">API revenue</span><span className="text-info">{formatUSD(s.apiRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Maintenance paid</span><span className="text-warn">-{formatUSD(s.maintenancePaid)}</span></div>
            {s.apisBuilt.length > 0 && <div className="flex justify-between"><span className="text-white/40">APIs built</span><span className="text-accent">{s.apisBuilt.length}</span></div>}
            {s.upgradesBought.length > 0 && <div className="flex justify-between"><span className="text-white/40">Upgrades bought</span><span className="text-accent">{s.upgradesBought.length}</span></div>}
            {s.agoraEarned > 0 && <div className="flex justify-between"><span className="text-white/40">$AGORA earned</span><span className="text-yellow-400">{formatAgora(s.agoraEarned)}</span></div>}
          </div>
          <button onClick={() => { setShowOfflineSummary(false); setGame(prev => ({ ...prev, offlineSummary: null })); }} className="w-full mt-4 py-2 rounded-lg bg-accent text-surface text-sm font-bold active:scale-95">
            CONTINUE
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing Screen ────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] w-full bg-surface flex flex-col relative overflow-hidden">
      {/* Tutorial overlay */}
      {game.tutorialStep >= 0 && (
        <TutorialOverlay step={game.tutorialStep} onNext={advanceTutorial} onSkip={skipTutorial} onSwitchTab={setTab as (t: string) => void} />
      )}

      {/* Toasts */}
      {tierUnlock !== null && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-accent/15 border border-accent/30 animate-pop">
          <div className="text-[9px] font-mono text-accent/60 tracking-wider">TIER UNLOCKED</div>
          <div className="text-sm font-bold text-white">{TIERS[tierUnlock]?.name}</div>
        </div>
      )}
      {questReward && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-warn/15 border border-warn/30 animate-pop">
          <div className="text-[9px] font-mono text-warn tracking-wider">QUEST COMPLETE</div>
          <div className="text-sm font-bold text-accent">+{formatUSD(questReward.amount)}</div>
        </div>
      )}

      {/* HUD */}
      <div className="shrink-0 px-3 pt-2 pb-1 z-20" data-tutorial="hud-usdc">
        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <span className="ticker text-lg font-bold text-accent">{formatUSD(game.balance)}</span>
              <span className="text-[8px] text-white/20 ml-1">USDC</span>
            </div>
            <div data-tutorial="hud-fac" className="flex items-center gap-1.5">
              <span className="ticker text-sm font-bold text-yellow-400">{isConnected ? formatTokenAmount(chainStake.balance) : '0'}</span>
              <span className="text-[8px] text-yellow-400/40">$AGORA</span>
              <button
                onClick={() => {
                  const sdk = window.frame?.sdk;
                  if (sdk) sdk.actions.swapToken({
                    sellToken: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                    buyToken: 'eip155:8453/erc20:0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131',
                  });
                }}
                className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/20 hover:bg-yellow-400/25 active:scale-95 transition-all"
              >
                GET
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[8px] font-mono">
            <div className="flex gap-2 text-white/30">
              <span>{formatRps(game.rps)}</span>
              <span>{accuracyPct}%</span>
              <span>{formatUSD(game.revenuePerReq)}/req</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-info tracking-wider">{currentTier.name}</span>
              {stakeLabel && <span className="text-[7px] px-1 py-0.5 rounded bg-yellow-400/10 text-yellow-400/70">{stakeLabel} STAKED</span>}
              {game.agoraStakeBonus > 1 && <span className="text-[7px] text-accent">x{game.agoraStakeBonus.toFixed(2)}</span>}
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="shrink-0 px-3 z-15">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-accent' : 'bg-white/15'}`} />
          <span className="text-[8px] font-mono text-white/25 shrink-0">
            {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'NO WALLET'}
          </span>
          <div className="flex-1" />
          {apiRevenuePerMin > 0 && <span className="text-[8px] font-mono text-info/50">API +{formatUSD(apiRevenuePerMin)}/min</span>}
          {maintenancePerMin > 0 && <span className="text-[8px] font-mono text-warn/50">-{formatUSD(maintenancePerMin)}/min</span>}
          {saveQueue.length > 0 && <span className="text-[8px] font-mono text-warn">{saveQueue.length} unsaved</span>}
          {saveQueue.length > 0 && isConnected && (
            <button onClick={saveOnChain} disabled={isSaving} className={`px-2 py-0.5 rounded text-[8px] font-bold ${isSaving ? 'bg-white/5 text-white/20 animate-pulse' : 'bg-accent/80 text-surface'}`}>
              {isSaving ? '...' : 'SAVE'}
            </button>
          )}
        </div>
      </div>

      {/* Pixi Canvas */}
      <div className="shrink-0 flex justify-center" data-tutorial="canvas">
        <GameCanvas gameRef={gameRef} width={424} height={220} />
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex gap-0.5 px-3 py-1 z-10">
        {([
          { id: 'feed' as TabId, label: 'FEED', badge: 0 },
          { id: 'build' as TabId, label: 'BUILD', badge: buildingApis },
          { id: 'agents' as TabId, label: 'AGENTS', badge: 0 },
          { id: 'infra' as TabId, label: 'INFRA', badge: 0 },
          { id: 'quests' as TabId, label: 'QUESTS', badge: QUESTS.filter(q => !completedQuests.has(q.id) && (q.type === 'social' || isMilestoneReady(q))).length },
          { id: 'about' as TabId, label: 'ABOUT', badge: 0 },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-tutorial={`tab-${t.id}`}
            className={`flex-1 py-1.5 text-[9px] font-mono tracking-wider rounded-lg transition-all relative ${
              tab === t.id ? 'bg-white/8 text-white border border-white/10' : 'text-white/25 hover:text-white/40'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="absolute -top-1 -right-0.5 w-3.5 h-3.5 rounded-full bg-warn text-surface text-[7px] font-bold flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 z-10">

        {/* ═══ FEED ═══ */}
        {tab === 'feed' && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'EARNED', value: formatUSD(game.totalEarned), color: 'text-accent' },
                { label: 'SETTLED', value: formatNumber(game.totalSettled), color: 'text-info' },
                { label: 'REJECTED', value: formatNumber(game.totalRejected), color: 'text-warn' },
                { label: 'MISSED', value: formatNumber(game.totalMissed), color: 'text-danger' },
              ].map(s => (
                <div key={s.label} className="text-center p-1.5 rounded-lg bg-surface-card border border-white/5">
                  <div className={`ticker text-sm font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[7px] text-white/25">{s.label}</div>
                </div>
              ))}
            </div>

            {/* API + Agent status row */}
            {(activeApis > 0 || activeAgents > 0) && (
              <div className="flex gap-2">
                {activeApis > 0 && (
                  <div className="flex-1 p-1.5 rounded-lg bg-info/5 border border-info/15">
                    <div className="text-[8px] font-mono text-info/50">API REVENUE</div>
                    <div className="text-[11px] font-bold text-info">{formatUSD(apiRevenuePerMin)}/min</div>
                    <div className="text-[8px] text-white/25">{activeApis} active, {buildingApis} building</div>
                  </div>
                )}
                {activeAgents > 0 && (
                  <div className="flex-1 p-1.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
                    <div className="text-[8px] font-mono text-purple-400/50">AGENTS</div>
                    <div className="text-[11px] font-bold text-purple-300">{activeAgents} active</div>
                    <div className="text-[8px] text-white/25">-{formatUSD(maintenancePerMin)}/min</div>
                  </div>
                )}
              </div>
            )}

            {/* Daily check-in */}
            {canCheckin && (
              <button onClick={dailyCheckin} className="w-full p-2 rounded-lg bg-yellow-400/5 border border-yellow-400/20 flex items-center justify-between hover:border-yellow-400/40 active:scale-[0.99] transition-all">
                <div>
                  <div className="text-[9px] font-mono text-yellow-400/60 tracking-wider">DAILY CHECK-IN</div>
                  <div className="text-[10px] text-white/50">Claim your daily $AGORA reward</div>
                </div>
                <span className="text-sm font-bold text-yellow-400">+{formatAgora(AGORA_REWARDS.dailyCheckin)}</span>
              </button>
            )}

            {/* On-chain reward pool */}
            {isConnected && (
              <div className="p-2 rounded-lg bg-accent/5 border border-accent/15">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[8px] font-mono text-accent/50 tracking-wider">REWARD POOL</div>
                  <span className="text-[8px] font-mono text-white/20">
                    Claimed: {formatTokenAmount(chainRewards.userClaimed)} $AGORA
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[8px] text-white/30">
                    Pool: {formatTokenAmount(chainRewards.poolBalance)} &middot; {chainRewards.totalClaims} claims
                  </div>
                  {(claimingReward || chainRewards.isPending) && (
                    <span className="text-[8px] font-mono text-accent/60 animate-pulse">
                      {claimingReward ? 'SIGNING...' : 'CLAIMING...'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-2 rounded-lg bg-info/5 border border-info/15">
              <div className="text-[8px] font-mono text-info/50 tracking-wider mb-0.5">x402 INSIGHT</div>
              <p className="text-[10px] text-white/50 leading-relaxed">{currentTier.x402Insight}</p>
            </div>

            <div className="p-2 rounded-lg bg-surface-card border border-white/5">
              <div className="text-[8px] font-mono text-white/25 mb-1 tracking-wider">LIVE PROCESSING</div>
              {game.recentCalls.length === 0 && game.feedEvents.length === 0 ? (
                <div className="text-[10px] text-white/15 font-mono animate-pulse py-4 text-center">AWAITING REQUESTS...</div>
              ) : (
                <CallFeed calls={game.recentCalls} events={game.feedEvents} />
              )}
            </div>
          </div>
        )}

        {/* ═══ BUILD ═══ */}
        {tab === 'build' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[8px] font-mono text-white/25 tracking-wider">API SLOTS</span>
              <span className="text-[10px] font-mono text-accent">{activeApis + buildingApis}/{game.apiSlots} DEPLOYED</span>
            </div>

            {API_DEFINITIONS.map(def => {
              const api = game.apis.find(a => a.id === def.id);
              if (!api) return null;
              const isLocked = api.status === 'locked';
              const isBuilding = api.status === 'building';
              const isActive = api.status === 'active';
              const isAvailable = api.status === 'available';
              const canBuild = isAvailable && game.balance >= def.buildCost && (activeApis + buildingApis) < game.apiSlots;
              const canUpgrade = isActive && api.version < 3 && game.balance >= apiUpgradeCost(def.buildCost, api.version);
              const rev = isActive ? apiRevenue(def, api.version, scoutActive) : 0;

              return (
                <div key={def.id} className={`p-2 rounded-lg border transition-all ${
                  isActive ? 'bg-surface-card border-accent/20' : isBuilding ? 'bg-surface-card border-info/20' : isLocked ? 'bg-surface-card border-white/3 opacity-40' : 'bg-surface-card border-white/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{def.icon}</span>
                      <div>
                        <span className="text-[10px] font-bold text-white/80">{def.name}</span>
                        <span className="text-[8px] text-white/25 ml-1">{def.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isActive && <span className="text-[8px] font-mono text-accent">v{api.version} {formatUSD(rev)}/min</span>}
                      {isBuilding && <span className="text-[8px] font-mono text-info animate-pulse">{Math.floor(api.buildProgress * 100)}%</span>}
                      {isLocked && <span className="text-[8px] font-mono text-white/20">Req: {TIERS[def.unlockTier]?.name}</span>}
                      {canBuild && (
                        <button onClick={() => deployApi(def.id)} className="px-2 py-0.5 rounded text-[8px] font-bold bg-accent text-surface active:scale-95">
                          BUILD {formatUSD(def.buildCost)}
                        </button>
                      )}
                      {canUpgrade && (
                        <button onClick={() => upgradeApi(def.id)} className="px-2 py-0.5 rounded text-[8px] font-bold bg-info/80 text-surface active:scale-95">
                          UP v{api.version + 1} {formatUSD(apiUpgradeCost(def.buildCost, api.version))}
                        </button>
                      )}
                      {isAvailable && !canBuild && (
                        <span className="text-[8px] font-mono text-white/20">{formatUSD(def.buildCost)}</span>
                      )}
                    </div>
                  </div>
                  {isBuilding && (
                    <div className="mt-1 h-1 rounded bg-white/5 overflow-hidden">
                      <div className="h-full bg-info transition-all" style={{ width: `${api.buildProgress * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ AGENTS ═══ */}
        {tab === 'agents' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[8px] font-mono text-white/25 tracking-wider">AGENT SLOTS</span>
              <span className="text-[10px] font-mono text-accent">{activeAgents}/{game.agentSlots} HIRED</span>
            </div>

            {AGENT_DEFINITIONS.map(def => {
              const agent = game.agents.find(a => a.id === def.id);
              if (!agent) return null;
              const isActive = agent.status === 'active';
              const isIdle = agent.status === 'idle';
              const isAvail = agent.status === 'available';
              const canHire = isAvail && game.balance >= def.hireCost && activeAgents < game.agentSlots;

              return (
                <div key={def.id} className={`p-2.5 rounded-lg border transition-all ${
                  isActive ? 'bg-surface-card border-purple-500/20' : isIdle ? 'bg-surface-card border-warn/20' : 'bg-surface-card border-white/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{def.icon}</span>
                      <div>
                        <span className="text-[10px] font-bold text-white/80">{def.name}</span>
                        <span className="text-[8px] text-white/25 ml-1">{def.role}</span>
                        <div className="text-[8px] text-white/30">{def.description}</div>
                        {isActive && agent.currentTask && (
                          <div className="text-[8px] text-purple-300/60 mt-0.5">{agent.currentTask}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] font-mono text-warn/60">-{formatUSD(def.maintenanceCost)}/min</span>
                      {canHire && (
                        <button onClick={() => hireAgent(def.id)} className="px-2 py-0.5 rounded text-[8px] font-bold bg-accent text-surface active:scale-95">
                          HIRE {formatUSD(def.hireCost)}
                        </button>
                      )}
                      {isAvail && !canHire && <span className="text-[8px] font-mono text-white/20">{formatUSD(def.hireCost)}</span>}
                      {isActive && (
                        <button onClick={() => fireAgent(def.id)} className="px-2 py-0.5 rounded text-[8px] font-mono text-danger/50 border border-danger/20 hover:border-danger/50">FIRE</button>
                      )}
                      {isIdle && <span className="text-[8px] font-mono text-warn animate-pulse">IDLE</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ INFRA ═══ */}
        {tab === 'infra' && (
          <div className="space-y-2 pt-1">
            {/* On-chain staking section */}
            <div className="p-2.5 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
              <div className="text-[8px] font-mono text-yellow-400/50 tracking-wider mb-1">ON-CHAIN STAKING</div>

              {!isConnected ? (
                <div className="text-[9px] text-white/30 py-2 text-center">Connect wallet to stake $AGORA on Base</div>
              ) : (
                <>
                  {/* Balances */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-yellow-400">{formatTokenAmount(chainStake.staked)}</span>
                      <span className="text-[8px] text-yellow-400/40 ml-1">staked</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-white/40">{formatTokenAmount(chainStake.balance)}</span>
                      <span className="text-[8px] text-white/20 ml-1">in wallet</span>
                    </div>
                  </div>

                  {/* Current tier */}
                  {chainStake.onChainTier > 0 && (
                    <div className="text-[9px] font-mono text-accent mt-0.5">
                      Tier {chainStake.onChainTier} &mdash; +{Number(chainStake.bonusBps) / 100}% boost
                    </div>
                  )}

                  {/* Next tier progress */}
                  {(() => {
                    const nextTier = STAKE_TIERS_WEI.find(t => chainStake.staked < t.threshold);
                    if (!nextTier) return null;
                    const pct = chainStake.staked > BigInt(0) ? Number((chainStake.staked * BigInt(100)) / nextTier.threshold) : 0;
                    return (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[8px] font-mono text-white/25">
                          <span>Next: {nextTier.label} ({nextTier.bonus})</span>
                          <span>{formatTokenAmount(chainStake.staked)}/{nextTier.label}</span>
                        </div>
                        <div className="h-1 rounded bg-white/5 overflow-hidden mt-0.5">
                          <div className="h-full bg-yellow-400/50 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Free-form stake */}
                  {chainStake.balance > BigInt(0) && (
                    <div className="flex gap-1.5 mt-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Amount"
                        value={stakeInput}
                        onChange={e => setStakeInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-white/80 placeholder-white/20 outline-none focus:border-yellow-400/30"
                      />
                      <button
                        onClick={() => setStakeInput(formatTokenAmount(chainStake.balance).replace(/[^0-9.]/g, ''))}
                        className="px-2 py-1 rounded bg-white/5 text-[8px] font-mono text-white/40 hover:text-white/60"
                      >
                        MAX
                      </button>
                      {(() => {
                        let amt = BigInt(0);
                        try { amt = parseEther(stakeInput || '0'); } catch { /* invalid input */ }
                        const canStake = amt > BigInt(0) && chainStake.balance >= amt;
                        const needsApprove = canStake && chainStake.needsApproval(amt);
                        return (
                          <button
                            onClick={() => {
                              if (!canStake) return;
                              if (needsApprove) {
                                pendingStakeRef.current = amt;
                                setStakingAction('approve');
                                chainStake.approve(amt);
                              } else {
                                setStakingAction('stake');
                                chainStake.stake(amt);
                              }
                            }}
                            disabled={!canStake || chainStake.isPending}
                            className={`px-3 py-1 rounded text-[8px] font-mono transition-all ${
                              canStake && !chainStake.isPending
                                ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 active:scale-95'
                                : 'bg-white/3 text-white/15'
                            }`}
                          >
                            {needsApprove ? 'APPROVE' : 'STAKE'}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {/* Stake tier buttons */}
                  <div className="flex gap-1.5 mt-2">
                    {STAKE_TIERS_WEI.map(tier => {
                      const achieved = chainStake.staked >= tier.threshold;
                      const delta = tier.threshold - chainStake.staked;
                      const canAfford = !achieved && delta > BigInt(0)&& chainStake.balance >= delta;
                      const needsApprove = canAfford && chainStake.needsApproval(delta);
                      const disabled = achieved || !canAfford || chainStake.isPending;

                      return (
                        <button
                          key={tier.label}
                          onClick={() => {
                            if (disabled) return;
                            if (needsApprove) {
                              pendingStakeRef.current = delta;
                              setStakingAction('approve');
                              chainStake.approve(tier.threshold);
                            } else {
                              setStakingAction('stake');
                              chainStake.stake(delta);
                            }
                          }}
                          disabled={disabled}
                          className={`flex-1 py-1 rounded text-[8px] font-mono transition-all ${
                            achieved ? 'bg-yellow-400/10 text-yellow-400/50' :
                            canAfford ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 active:scale-95' :
                            'bg-white/3 text-white/15'
                          }`}
                        >
                          {achieved ? `${tier.label} \u2713` : needsApprove ? 'APPROVE' : tier.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pending tx indicator */}
                  {chainStake.isPending && (
                    <div className="text-[8px] font-mono text-yellow-400/60 animate-pulse mt-1 text-center">
                      {stakingAction === 'approve' ? 'Approving...' : stakingAction === 'stake' ? 'Staking...' : stakingAction === 'unstake' ? 'Unstaking...' : 'Claiming...'}
                    </div>
                  )}

                  {/* Unstaking progress */}
                  {chainStake.unstaking > BigInt(0)&& (
                    <div className="mt-1.5 p-1.5 rounded bg-white/3 border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono text-white/40">
                          Unstaking {formatTokenAmount(chainStake.unstaking)}
                        </span>
                        {Date.now() / 1000 >= chainStake.unstakeAt ? (
                          <button
                            onClick={() => { setStakingAction('claim'); chainStake.claimUnstake(); }}
                            disabled={chainStake.isPending}
                            className="px-2 py-0.5 rounded text-[8px] font-bold bg-accent text-surface active:scale-95"
                          >
                            CLAIM (1% burn)
                          </button>
                        ) : (
                          <span className="text-[8px] font-mono text-warn/60">
                            {Math.max(0, Math.ceil(chainStake.unstakeAt - Date.now() / 1000))}s left
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Unstake button */}
                  {chainStake.staked > BigInt(0)&& chainStake.unstaking === BigInt(0) && (
                    <button
                      onClick={() => { setStakingAction('unstake'); chainStake.initiateUnstake(chainStake.staked); }}
                      disabled={chainStake.isPending}
                      className="w-full mt-1.5 py-1 rounded text-[8px] font-mono text-white/25 border border-white/8 hover:border-white/15"
                    >
                      UNSTAKE ALL (1% burn, 30s cooldown)
                    </button>
                  )}

                  {/* Global stats */}
                  <div className="flex justify-between mt-2 text-[7px] font-mono text-white/15">
                    <span>Total staked: {formatTokenAmount(chainStake.globalStaked)}</span>
                    <span>Total burned: {formatTokenAmount(chainStake.globalBurned)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Burn-to-boost */}
            <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
              <div className="text-[8px] font-mono text-red-400/50 tracking-wider mb-1">BURN $AGORA (PERMANENT)</div>
              <div className="text-[8px] text-white/25 mb-1.5">
                {isConnected ? `Wallet: ${formatTokenAmount(chainStake.balance)} $AGORA` : 'Connect wallet to burn'}
                {' · '}Network burned: {formatTokenAmount(chainStake.globalBurned)}
              </div>
              {(isBurning || isBurnConfirming) && (
                <div className="text-[8px] font-mono text-red-400/60 animate-pulse mb-1.5 text-center">
                  {isBurning ? 'CONFIRM IN WALLET...' : 'BURNING...'}
                </div>
              )}
              <div className="space-y-1">
                {BURN_BOOSTS.map(boost => {
                  const owned = game.burnBoosts.includes(boost.id);
                  const costWei = parseEther(String(boost.cost));
                  const canAfford = isConnected && chainStake.balance >= costWei;
                  const isPending = pendingBurnBoost === boost.id && (isBurning || isBurnConfirming);
                  return (
                    <button
                      key={boost.id}
                      onClick={() => !owned && canAfford && !isBurning && !isBurnConfirming && burnForBoost(boost.id)}
                      disabled={owned || !canAfford || isBurning || isBurnConfirming}
                      className={`w-full flex items-center justify-between p-1.5 rounded border text-[9px] transition-all ${
                        owned ? 'bg-red-500/5 border-red-500/10 opacity-50' :
                        isPending ? 'bg-red-500/10 border-red-500/30 animate-pulse' :
                        canAfford ? 'bg-surface-card border-red-500/20 hover:border-red-500/40' :
                        'bg-surface-card border-white/5 opacity-40'
                      }`}
                    >
                      <span className="text-white/60">{boost.name}</span>
                      {owned ? <span className="font-mono text-red-400/50">ACTIVE</span> :
                       isPending ? <span className="font-mono text-red-400/60">PENDING...</span> :
                       <span className="font-mono text-red-400">{formatAgora(boost.cost)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agent Launchpad CTA — links to /agents portal */}
            <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
              <div className="text-[8px] font-mono text-purple-400/50 tracking-wider mb-1">AGENT LAUNCHPAD</div>
              <div className="text-[8px] text-white/30 mb-2">Ready to launch your own x402 agent?</div>
              {chainSub.active ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-300">{chainSub.agentName || 'unnamed'}</span>
                    <span className="text-[8px] font-mono text-accent flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-accent" />
                      ACTIVE
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const url = 'https://agora.jumpbox.tech/agents';
                      const sdk = window.frame?.sdk;
                      if (sdk) sdk.actions.openUrl(url); else window.open(url, '_blank');
                    }}
                    className="w-full py-1.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-95 transition-all"
                  >
                    MANAGE AGENT →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const url = 'https://agora.jumpbox.tech/agents';
                    const sdk = window.frame?.sdk;
                    if (sdk) sdk.actions.openUrl(url); else window.open(url, '_blank');
                  }}
                  className="w-full py-1.5 rounded text-[9px] font-bold bg-purple-500/80 text-white hover:bg-purple-500 active:scale-95 transition-all"
                >
                  LAUNCH YOUR AGENT →
                </button>
              )}
              {chainSub.totalActive > 0 && (
                <div className="flex justify-between mt-2 text-[7px] font-mono text-white/15">
                  <span>{chainSub.totalActive} agents live</span>
                  <span>Burned: {formatTokenAmount(chainSub.totalBurned)}</span>
                </div>
              )}
            </div>

            {/* Upgrades */}
            <div className="text-[8px] font-mono text-white/20 tracking-wider">UPGRADES</div>
            {UPGRADES.map(upg => {
              const level = game.upgrades[upg.id] || 0;
              const cost = getUpgradeCost(upg.cost, level);
              return <UpgradeButton key={upg.id} id={upg.id} name={upg.name} icon={upg.icon} description={upg.description} level={level} maxLevel={upg.maxLevel} cost={cost} canAfford={game.balance >= cost} onBuy={buyUpgrade} />;
            })}

            {/* Tiers */}
            <div className="text-[8px] font-mono text-white/20 tracking-wider mt-2">TIERS</div>
            {TIERS.map((t, i) => {
              const isOwned = i <= game.tier;
              const isCurrent = i === game.tier;
              const isNext = i === game.tier + 1;
              const canAfford = game.balance >= t.cost;
              return (
                <div key={t.id} className={`p-2 rounded-lg border transition-all ${
                  isCurrent ? 'bg-accent/5 border-accent/30' : isOwned ? 'bg-surface-card border-white/8 opacity-50' : isNext ? canAfford ? 'bg-surface-card border-info/30' : 'bg-surface-card border-white/5' : 'bg-surface-card border-white/3 opacity-30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-accent animate-pulse' : isOwned ? 'bg-white/20' : 'bg-white/5'}`} />
                      <span className={`text-xs font-bold ${isCurrent ? 'text-accent' : isOwned ? 'text-white/40' : 'text-white/60'}`}>{t.name}</span>
                    </div>
                    {isNext && (
                      <button onClick={() => canAfford && buyTier(i)} disabled={!canAfford} className={`px-3 py-1 rounded text-[9px] font-bold ${canAfford ? 'bg-accent text-surface active:scale-95' : 'bg-white/5 text-white/20'}`}>
                        {formatUSD(t.cost)}
                      </button>
                    )}
                    {isCurrent && <span className="text-[8px] font-mono text-accent/50 tracking-wider">ACTIVE</span>}
                  </div>
                  <div className="text-[9px] text-white/30 mt-0.5">{t.description}</div>
                  <div className="flex gap-3 mt-1 text-[8px] font-mono text-white/20">
                    <span>{formatRps(t.baseRps)} base</span>
                    <span>{Math.floor(t.baseAccuracy * 100)}% filter</span>
                    <span>{formatUSD(t.baseRevenue)}/req</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ QUESTS ═══ */}
        {tab === 'quests' && (
          <div className="space-y-1.5 pt-1">
            <div className="p-2 rounded-lg bg-surface-card border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono text-white/25 tracking-wider">QUEST PROGRESS</span>
                <span className="text-[10px] font-mono text-accent">{completedQuests.size}/{QUESTS.length}</span>
              </div>
              <div className="h-1 rounded bg-white/8 overflow-hidden mt-1">
                <div className="h-full rounded bg-accent transition-all duration-500" style={{ width: `${(completedQuests.size / QUESTS.length) * 100}%` }} />
              </div>
            </div>

            <div className="text-[8px] font-mono text-white/20 tracking-wider mt-2 mb-0.5">SOCIAL</div>
            {QUESTS.filter(q => q.type === 'social').map(q => (
              <QuestCard key={q.id} quest={q} completed={completedQuests.has(q.id)} claiming={claimingQuest === q.id} canClaim={true} onClaim={claimQuest} />
            ))}

            <div className="text-[8px] font-mono text-white/20 tracking-wider mt-2 mb-0.5">MILESTONES</div>
            {QUESTS.filter(q => q.type === 'milestone').map(q => (
              <QuestCard key={q.id} quest={q} completed={completedQuests.has(q.id)} claiming={claimingQuest === q.id} canClaim={isMilestoneReady(q)} onClaim={claimQuest} />
            ))}

            {/* Replay tutorial */}
            <button onClick={replayTutorial} className="w-full mt-3 py-1.5 rounded-lg text-[9px] font-mono text-white/25 border border-white/8 hover:border-white/15 transition-all">
              REPLAY TUTORIAL
            </button>

            {/* On-chain save */}
            <div className="text-[8px] font-mono text-white/20 tracking-wider mt-3 mb-0.5">ON-CHAIN SAVE</div>
            <div className="p-2 rounded-lg bg-surface-card border border-white/5">
              {saveQueue.length === 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/25">No pending saves</span>
                  {lastSaveTx && (
                    <button onClick={() => window.frame?.sdk?.actions.openUrl(basescanTxUrl(lastSaveTx))} className="text-[8px] font-mono text-accent/50 hover:text-accent">VIEW TX</button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {saveQueue.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[9px]">
                      <div className="w-1 h-1 rounded-full bg-warn/60" />
                      <span className="text-white/40 font-mono">{formatSaveItem(item)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-3 pt-1">
            {/* What is Agora */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">WHAT IS AGORA</div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                x402 infrastructure tycoon game on Farcaster. Deploy payment APIs, hire AI agents, stake $AGORA for revenue boosts, and earn USDC. Live on Base mainnet.
              </p>
            </div>

            {/* How it works */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">HOW IT WORKS</div>
              <div className="space-y-1.5">
                {[
                  { step: '01', text: 'Deploy x402 payment APIs to process requests' },
                  { step: '02', text: 'Earn USDC revenue from processed transactions' },
                  { step: '03', text: 'Stake $AGORA tokens for revenue multipliers' },
                  { step: '04', text: 'Burn $AGORA for permanent infrastructure boosts' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-2">
                    <span className="text-[9px] font-mono text-accent/40 mt-0.5">{s.step}</span>
                    <span className="text-[10px] text-white/50">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contracts */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">CONTRACTS</div>
              <div className="space-y-1.5">
                {[
                  { name: '$AGORA Token', addr: AGORA_TOKEN },
                  { name: 'Staking', addr: AGORA_STAKING },
                  { name: 'Agent Subscriptions', addr: '0x4FF5385a533FF88fc848946cB13974F44201896b' },
                  { name: 'Rewards', addr: '0x0fdaB9D5e76E6b6Ba882044900c1976Dd7648c4b' },
                ].map(c => (
                  <button
                    key={c.addr}
                    onClick={() => window.frame?.sdk?.actions.openUrl(`https://basescan.org/address/${c.addr}`)}
                    className="w-full flex items-center justify-between py-1 group"
                  >
                    <span className="text-[10px] text-white/40">{c.name}</span>
                    <span className="text-[9px] font-mono text-accent/50 group-hover:text-accent transition-colors">
                      {c.addr.slice(0, 6)}...{c.addr.slice(-4)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tokenomics */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">TOKENOMICS</div>
              <div className="text-[10px] text-white/40 mb-2">100B supply / 90-day drip</div>
              <div className="space-y-1">
                {[
                  { pct: 40, label: 'Staking Rewards', color: 'bg-accent' },
                  { pct: 25, label: 'Community', color: 'bg-info' },
                  { pct: 20, label: 'Expansion', color: 'bg-warn' },
                  { pct: 15, label: 'Gameplay', color: 'bg-danger' },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-sm ${t.color} shrink-0`} />
                    <div className="flex-1 h-1.5 rounded bg-white/5 overflow-hidden">
                      <div className={`h-full rounded ${t.color}/30`} style={{ width: `${t.pct}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-white/30 w-[28px] text-right">{t.pct}%</span>
                    <span className="text-[9px] text-white/40 w-[80px]">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">LINKS</div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.frame?.sdk?.actions.openUrl('https://agora.jumpbox.tech/stats')}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-mono bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-all"
                >
                  STATS
                </button>
                <button
                  onClick={() => window.frame?.sdk?.actions.openUrl('https://agora.jumpbox.tech/docs')}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-mono bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-all"
                >
                  DOCS
                </button>
                <button
                  onClick={() => window.frame?.sdk?.actions.openUrl('https://github.com/jumpboxtech/agora')}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-mono bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-all"
                >
                  GITHUB
                </button>
              </div>
            </div>

            {/* Socials */}
            <div className="p-3 rounded-xl bg-surface-card border border-white/5">
              <div className="text-[10px] font-mono tracking-[0.3em] text-accent/60 mb-2">SOCIALS</div>
              <div className="flex gap-2">
                {[
                  { label: 'FARCASTER', url: 'https://warpcast.com/jumpbox.eth' },
                  { label: 'X', url: 'https://x.com/jumpbox_tech' },
                  { label: 'WEB', url: 'https://jumpbox.tech' },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => window.frame?.sdk?.actions.openUrl(s.url)}
                    className="flex-1 py-1.5 rounded-lg text-[9px] font-mono bg-white/5 border border-white/8 text-white/40 hover:text-white/60 hover:border-white/15 transition-all"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] font-mono text-white/15 pb-2">
              Built by Jumpbox
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
