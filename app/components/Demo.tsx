'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { FrameContext } from '../types/frame';
import {
  type GameState,
  type PaymentRequest,
  type DecisionResult,
  createInitialState,
  generateRequest,
  evaluateDecision,
  evaluateExpiry,
  getAgentName,
  formatUSDC,
  truncAddr,
  LEVELS,
} from '../lib/engine';

// ─── Sub-components ──────────────────────────────────────────────────────────

function HudBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="hud-bar w-full">
      <div
        className="hud-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function JsonField({
  label,
  value,
  isError,
}: {
  label: string;
  value: string | number;
  isError?: boolean;
}) {
  const valStr = typeof value === 'number' ? String(value) : `"${value}"`;
  return (
    <div className="flex items-start gap-1 text-[10px] leading-snug font-mono">
      <span className="json-key shrink-0">&quot;{label}&quot;</span>
      <span className="text-white/30">:</span>
      <span className={isError ? 'json-error' : typeof value === 'number' ? 'json-number' : 'json-string'}>
        {isError ? valStr + ' ⚠' : valStr}
      </span>
    </div>
  );
}

// ─── Main Game Component ─────────────────────────────────────────────────────

export default function Demo() {
  const [frameData, setFrameData] = useState<FrameContext | null>(null);
  const [game, setGame] = useState<GameState>(createInitialState());
  const [feedback, setFeedback] = useState<{ result: DecisionResult; id: string } | null>(null);
  const [agentNames] = useState<Map<string, string>>(() => new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init Farcaster SDK
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        if (typeof window !== 'undefined' && window.frame?.sdk) {
          window.frame.sdk.actions.ready();
          const ctx = await window.frame.sdk.context;
          if (mounted) setFrameData(ctx);
        }
      } catch {
        // Not in Farcaster — browser mode
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Get agent name for request
  const getNameForRequest = useCallback((id: string) => {
    if (!agentNames.has(id)) agentNames.set(id, getAgentName());
    return agentNames.get(id)!;
  }, [agentNames]);

  // Start level
  const startLevel = useCallback((levelNum: number) => {
    const config = LEVELS[levelNum - 1];
    if (!config) return;

    setGame(prev => ({
      ...prev,
      level: levelNum,
      phase: 'playing',
      requests: [],
      selectedId: null,
      levelStartTime: Date.now(),
      processedThisLevel: 0,
      correctThisLevel: 0,
    }));
  }, []);

  // Spawn requests on interval
  useEffect(() => {
    if (game.phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const config = LEVELS[game.level - 1];
    if (!config) return;

    timerRef.current = setInterval(() => {
      setGame(prev => {
        const pending = prev.requests.filter(r => r.status === 'pending');
        if (pending.length >= config.maxQueue) return prev;
        const req = generateRequest(config);
        return { ...prev, requests: [...prev.requests, req] };
      });
    }, config.requestInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game.phase, game.level]);

  // Expiry checker
  useEffect(() => {
    if (game.phase !== 'playing') {
      if (expiryRef.current) clearInterval(expiryRef.current);
      return;
    }

    expiryRef.current = setInterval(() => {
      const now = Date.now();
      setGame(prev => {
        let changed = false;
        let health = prev.health;
        let reputation = prev.reputation;
        let score = prev.score;
        let totalProcessed = prev.totalProcessed;
        let processedThisLevel = prev.processedThisLevel;

        const updated = prev.requests.map(r => {
          if (r.status === 'pending' && now > r.expiresAt) {
            changed = true;
            const result = evaluateExpiry(r);
            score = Math.max(0, score + result.scoreChange);
            health = Math.max(0, health + result.healthChange);
            reputation = Math.max(0, reputation + result.reputationChange);
            totalProcessed++;
            processedThisLevel++;
            return { ...r, status: 'expired' as const };
          }
          return r;
        });

        if (!changed) return prev;

        const newPhase = (health <= 0 || reputation <= 0) ? 'gameover' as const : prev.phase;

        return {
          ...prev,
          requests: updated,
          score,
          health,
          reputation,
          streak: 0,
          totalProcessed,
          processedThisLevel,
          phase: newPhase,
        };
      });
    }, 500);

    return () => {
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, [game.phase]);

  // Clean old resolved requests
  useEffect(() => {
    if (game.phase !== 'playing') return;
    const cleanup = setInterval(() => {
      setGame(prev => ({
        ...prev,
        requests: prev.requests.filter(
          r => r.status === 'pending' || Date.now() - r.timestamp < 3000
        ),
      }));
    }, 2000);
    return () => clearInterval(cleanup);
  }, [game.phase]);

  // Handle player decision
  const handleDecision = useCallback((action: 'approve' | 'reject') => {
    setGame(prev => {
      const req = prev.requests.find(r => r.id === prev.selectedId && r.status === 'pending');
      if (!req) return prev;

      const result = evaluateDecision(req, action, prev.streak);
      const newStreak = result.correct ? prev.streak + 1 : 0;
      const elapsed = (Date.now() - prev.levelStartTime) / 60000;
      const processed = prev.processedThisLevel + 1;
      const newScore = Math.max(0, prev.score + result.scoreChange);

      let newPhase = prev.phase;
      const config = LEVELS[prev.level - 1];
      const newHealth = Math.max(0, Math.min(100, prev.health + result.healthChange));
      const newRep = Math.max(0, Math.min(100, prev.reputation + result.reputationChange));

      if (newHealth <= 0 || newRep <= 0) {
        newPhase = 'gameover';
      } else if (config && newScore >= config.requiredScore) {
        newPhase = prev.level < LEVELS.length ? 'levelup' : 'gameover';
      }

      // Show feedback
      setFeedback({ result, id: req.id });
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 1500);

      return {
        ...prev,
        score: newScore,
        health: newHealth,
        reputation: newRep,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        totalProcessed: prev.totalProcessed + 1,
        correctDecisions: prev.correctDecisions + (result.correct ? 1 : 0),
        throughput: elapsed > 0 ? Math.round(processed / elapsed) : 0,
        processedThisLevel: processed,
        correctThisLevel: prev.correctThisLevel + (result.correct ? 1 : 0),
        selectedId: null,
        phase: newPhase,
        requests: prev.requests.map(r =>
          r.id === req.id
            ? { ...r, status: (action === 'approve' ? 'approved' : 'rejected') as PaymentRequest['status'] }
            : r
        ),
      };
    });
  }, []);

  // Select request
  const selectRequest = useCallback((id: string) => {
    setGame(prev => ({ ...prev, selectedId: prev.selectedId === id ? null : id }));
  }, []);

  // ─── Derived values ────────────────────────────────────────────────────────

  const config = LEVELS[game.level - 1];
  const selectedReq = game.requests.find(r => r.id === game.selectedId);
  const pendingRequests = game.requests.filter(r => r.status === 'pending');
  const accuracy = game.totalProcessed > 0
    ? Math.round((game.correctDecisions / game.totalProcessed) * 100)
    : 100;

  // ─── Menu Screen ────────────────────────────────────────────────────────────

  if (game.phase === 'menu') {
    return (
      <div className="h-[100dvh] w-full bg-surface bg-grid flex flex-col items-center justify-center relative overflow-hidden">
        <div className="scanline" />
        <div className="noise" />

        <div className="relative z-10 flex flex-col items-center gap-5 px-5 text-center">
          <div className="relative">
            <div className="text-[9px] font-mono tracking-[0.3em] text-accent/60 mb-1">
              x402 PROTOCOL
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white animate-glitch">
              FACILITATOR
            </h1>
            <div className="text-xs text-white/40 mt-2 font-light tracking-wide">
              Payment Verification Simulator
            </div>
          </div>

          <p className="text-xs text-white/50 max-w-[300px] leading-relaxed">
            You are the x402 facilitator. Verify payment signatures.
            Catch malformed requests. Settle USDC on Base.
          </p>

          {frameData?.user && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
              {frameData.user.pfpUrl && (
                <img src={frameData.user.pfpUrl} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="text-xs text-white/70">@{frameData.user.username}</span>
            </div>
          )}

          <button
            onClick={() => startLevel(1)}
            className="btn-approve px-8 py-3 text-base tracking-wide mt-2"
          >
            INITIALIZE
          </button>

          <div className="text-[9px] text-white/20 font-mono mt-2">
            6 LEVELS &middot; 12 ERROR TYPES &middot; REAL x402 PAYLOADS
          </div>
        </div>
      </div>
    );
  }

  // ─── Level Up Screen ────────────────────────────────────────────────────────

  if (game.phase === 'levelup') {
    const nextLevel = LEVELS[game.level];
    return (
      <div className="level-overlay">
        <div className="scanline" />
        <div className="noise" />

        <div className="relative z-10 flex flex-col items-center gap-4 px-5 text-center animate-pop">
          <div className="text-accent text-[10px] font-mono tracking-[0.3em]">LEVEL COMPLETE</div>
          <h2 className="text-3xl font-bold text-white text-glow-green">
            {config?.name}
          </h2>

          <div className="flex gap-6 text-center mt-2">
            <div>
              <div className="text-xl font-bold text-accent ticker">{game.score}</div>
              <div className="text-[9px] text-white/40">SCORE</div>
            </div>
            <div>
              <div className="text-xl font-bold text-info ticker">{game.throughput}</div>
              <div className="text-[9px] text-white/40">REQ/MIN</div>
            </div>
            <div>
              <div className="text-xl font-bold text-warn ticker">{accuracy}%</div>
              <div className="text-[9px] text-white/40">ACCURACY</div>
            </div>
          </div>

          <div className="max-w-[340px] mt-2 p-3 rounded-lg bg-info/5 border border-info/20">
            <div className="text-[9px] font-mono text-info/60 mb-1.5 tracking-wider">PROTOCOL INSIGHT</div>
            <p className="text-[11px] text-white/60 leading-relaxed">{config?.educationTip}</p>
          </div>

          {nextLevel && (
            <div className="mt-2">
              <div className="text-[9px] text-white/30 mb-1">NEXT: LEVEL {nextLevel.level}</div>
              <h3 className="text-base font-bold text-white">{nextLevel.name}</h3>
              <p className="text-[11px] text-white/40 mt-0.5">{nextLevel.description}</p>
            </div>
          )}

          <button
            onClick={() => startLevel(game.level + 1)}
            className="btn-approve px-8 py-2.5 text-sm tracking-wide mt-2"
          >
            CONTINUE
          </button>
        </div>
      </div>
    );
  }

  // ─── Game Over Screen ───────────────────────────────────────────────────────

  if (game.phase === 'gameover') {
    const won = game.level >= LEVELS.length && game.score >= (config?.requiredScore ?? 0);
    return (
      <div className="level-overlay">
        <div className="scanline" />
        <div className="noise" />

        <div className="relative z-10 flex flex-col items-center gap-4 px-5 text-center animate-pop">
          <div className={`text-[10px] font-mono tracking-[0.3em] ${won ? 'text-accent' : 'text-danger'}`}>
            {won ? 'PROTOCOL MASTERED' : 'SYSTEM FAILURE'}
          </div>
          <h2 className={`text-3xl font-bold ${won ? 'text-glow-green text-white' : 'text-glow-red text-white'}`}>
            {won ? 'COMPLETE' : 'GAME OVER'}
          </h2>

          {!won && (
            <p className="text-xs text-white/50">
              {game.health <= 0
                ? 'Too many bad settlements. System compromised.'
                : 'Too many false rejects. Reputation destroyed.'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="text-center">
              <div className="text-xl font-bold text-accent ticker">{game.score}</div>
              <div className="text-[9px] text-white/40">FINAL SCORE</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-info ticker">L{game.level}</div>
              <div className="text-[9px] text-white/40">LEVEL</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-warn ticker">{game.bestStreak}</div>
              <div className="text-[9px] text-white/40">BEST STREAK</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white ticker">{accuracy}%</div>
              <div className="text-[9px] text-white/40">ACCURACY</div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setGame(createInitialState());
                setTimeout(() => startLevel(1), 0);
              }}
              className="btn-approve px-6 py-2.5 text-sm tracking-wide"
            >
              RETRY
            </button>
            {frameData && (
              <button
                onClick={() => {
                  if (window.frame?.sdk) {
                    const text = `I ${won ? 'mastered' : 'scored ' + game.score + ' on'} Facilitator — the x402 payment verification game. Level ${game.level}, ${accuracy}% accuracy.`;
                    window.frame.sdk.actions.openUrl(
                      `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://facilitator.jumpbox.tech`
                    );
                  }
                }}
                className="px-6 py-2.5 text-sm tracking-wide bg-white/10 text-white font-bold rounded-lg hover:bg-white/15 transition-colors"
              >
                SHARE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Playing Screen ─────────────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] w-full bg-surface bg-grid flex flex-col relative overflow-hidden">
      <div className="scanline" />
      <div className="noise" />

      {/* HUD — Floating sheet overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-2 pb-2">
        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-accent tracking-[0.2em]">
                LVL {game.level}
              </span>
              <span className="text-[10px] text-white/30">{config?.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="ticker text-sm font-bold text-accent">{game.score}</span>
                <span className="text-[8px] text-white/30 ml-0.5">/{config?.requiredScore}</span>
              </div>
              {game.streak >= 3 && (
                <span className="text-[9px] font-mono text-warn animate-pulse-fast">
                  x{game.streak}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex justify-between mb-0.5">
                <span className="text-[8px] text-white/30">HP</span>
                <span className="text-[8px] text-white/30 ticker">{game.health}</span>
              </div>
              <HudBar value={game.health} max={100} color={game.health > 30 ? '#00ff88' : '#ff3366'} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-0.5">
                <span className="text-[8px] text-white/30">REP</span>
                <span className="text-[8px] text-white/30 ticker">{game.reputation}</span>
              </div>
              <HudBar value={game.reputation} max={100} color={game.reputation > 30 ? '#38bdf8' : '#ff3366'} />
            </div>
          </div>

          <div className="flex justify-between text-[8px] text-white/20">
            <span>{pendingRequests.length} queued</span>
            <span className="ticker">{game.throughput} req/min</span>
            <span>{accuracy}%</span>
          </div>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`absolute top-[88px] left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg text-xs font-bold animate-pop ${
            feedback.result.correct
              ? 'bg-accent/20 text-accent border border-accent/30'
              : 'bg-danger/20 text-danger border border-danger/30 animate-shake'
          }`}
        >
          {feedback.result.correct ? '+' : ''}{feedback.result.scoreChange} &middot; {feedback.result.message}
        </div>
      )}

      {/* Request Queue — padded for floating HUD + action bar */}
      <div className="flex-1 overflow-y-auto px-3 pt-[84px] pb-[60px] space-y-1.5 relative z-10">
        {pendingRequests.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-white/20 text-sm font-mono animate-pulse">
              AWAITING REQUESTS...
            </div>
          </div>
        )}
        {game.requests.map(req => {
          const isPending = req.status === 'pending';
          const isSelected = req.id === game.selectedId;
          const statusClass = req.status === 'approved' ? 'valid-result'
            : req.status === 'rejected' ? 'invalid-result'
            : req.status === 'expired' ? 'opacity-30' : '';

          if (!isPending && Date.now() - req.timestamp > 2000) return null;

          const timeLeft = isPending ? Math.max(0, req.expiresAt - Date.now()) : 0;
          const timeLeftPct = isPending ? (timeLeft / (config?.requestTimeout ?? 10000)) * 100 : 0;

          return (
            <div
              key={req.id}
              onClick={() => isPending && selectRequest(req.id)}
              className={`request-card p-2.5 animate-slide-in ${statusClass} ${isSelected ? 'selected' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-warn animate-pulse-fast' : req.status === 'approved' ? 'bg-accent' : 'bg-danger'}`} />
                  <span className="text-xs font-mono text-white/60">{getNameForRequest(req.id)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/30">
                    {formatUSDC(req.payload.amount)}
                  </span>
                  {isPending && (
                    <div className="w-12 h-1 rounded bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${timeLeftPct}%`,
                          background: timeLeftPct > 30 ? '#ffaa00' : '#ff3366',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {!isSelected && (
                <div className="flex gap-4 text-[10px] font-mono text-white/30">
                  <span>from: {truncAddr(req.payload.from)}</span>
                  <span>to: {truncAddr(req.payload.to)}</span>
                  <span>{req.payload.scheme || '???'}</span>
                </div>
              )}

              {isSelected && isPending && (
                <div className="mt-1.5 p-2 rounded bg-black/40 border border-white/5 space-y-0 text-left">
                  <JsonField label="scheme" value={req.payload.scheme || ''}
                    isError={req.errorType === 'wrong_scheme' || (req.errorType === 'missing_field' && !req.payload.scheme)} />
                  <JsonField label="network" value={req.payload.network || ''}
                    isError={req.errorType === 'network_mismatch' || (req.errorType === 'missing_field' && !req.payload.network)} />
                  <JsonField label="asset" value={truncAddr(req.payload.asset)}
                    isError={req.errorType === 'wrong_asset'} />
                  <JsonField label="amount" value={req.payload.amount} />
                  <JsonField label="value" value={req.payload.value}
                    isError={req.errorType === 'amount_mismatch'} />
                  <JsonField label="from" value={truncAddr(req.payload.from)}
                    isError={req.errorType === 'missing_field' && !req.payload.from} />
                  <JsonField label="to" value={truncAddr(req.payload.to)}
                    isError={req.errorType === 'recipient_mismatch'} />
                  <JsonField label="payTo" value={truncAddr(req.payload.payTo)} />
                  <JsonField label="validAfter" value={req.payload.validAfter}
                    isError={req.errorType === 'future_valid_after'} />
                  <JsonField label="validBefore" value={req.payload.validBefore}
                    isError={req.errorType === 'expired_valid_before'} />
                  <JsonField label="nonce" value={truncAddr(req.payload.nonce)}
                    isError={req.errorType === 'bad_nonce' || (req.errorType === 'missing_field' && !req.payload.nonce)} />
                  <JsonField label="signature" value={truncAddr(req.payload.signature)}
                    isError={req.errorType === 'bad_signature' || (req.errorType === 'missing_field' && !req.payload.signature)} />
                  <JsonField label="balance" value={req.payload.balance}
                    isError={req.errorType === 'insufficient_funds'} />
                </div>
              )}

              {!isPending && req.status !== 'expired' && (
                <div className={`mt-1 text-[10px] font-mono ${
                  (req.isValid && req.status === 'approved') || (!req.isValid && req.status === 'rejected')
                    ? 'text-accent' : 'text-danger'
                }`}>
                  {req.isValid
                    ? (req.status === 'approved' ? 'SETTLED' : 'FALSE REJECT')
                    : (req.status === 'rejected' ? req.errorHint : 'BAD SETTLEMENT')
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons — Floating sheet overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3">
        <div className="px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/8">
          {selectedReq && selectedReq.status === 'pending' ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision('reject')}
                className="btn-reject flex-1 py-2.5 text-sm tracking-wider"
              >
                REJECT
              </button>
              <button
                onClick={() => handleDecision('approve')}
                className="btn-approve flex-1 py-2.5 text-sm tracking-wider"
              >
                APPROVE
              </button>
            </div>
          ) : (
            <div className="text-center text-[10px] text-white/20 py-1.5">
              TAP A REQUEST TO INSPECT
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
