'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther, formatEther } from 'viem';
import type { CurveInfo } from '../../lib/agora-data';
import {
  AGORA_TOKEN,
  AGORA_LAUNCHPAD,
  LAUNCHPAD_ABI,
  ERC20_ABI,
} from '../../lib/contracts';

const LP_ADDR = AGORA_LAUNCHPAD as `0x${string}`;
const TOKEN_ADDR = AGORA_TOKEN as `0x${string}`;

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentData = {
  address: string;
  tier: number;
  payTo: string;
  active: boolean;
  endpointUrl: string;
  hasToken: boolean;
  curveId: number | null;
  endpoints: { path: string; priceAgora: string; paymentMode: number; active: boolean }[];
};

type Props = {
  agentName: string;
  agent: AgentData;
  initialCurve: CurveInfo | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const TIER_NAMES = ['', 'Starter', 'Pro', 'Enterprise'];
const COLORS = {
  accent: '#00ff88',
  purple: '#a855f7',
  info: '#38bdf8',
  danger: '#ff3366',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AgentProfile({ agentName, agent, initialCurve }: Props) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<'overview' | 'trade' | 'api'>('overview');

  const subdomainUrl = `https://${agentName}.agora.jumpbox.tech`;
  const tierName = TIER_NAMES[agent.tier] || '?';

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/agents" className="text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors">
            &larr; ALL AGENTS
          </Link>
          <ConnectButton.Custom>
            {({ openConnectModal, account, mounted }) => (
              <button
                onClick={openConnectModal}
                className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-all"
              >
                {mounted && account ? truncAddr(account.address) : 'CONNECT'}
              </button>
            )}
          </ConnectButton.Custom>
        </div>

        {/* Agent Card */}
        <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/[0.03] space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-300">{agentName}</div>
              <a
                href={subdomainUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-purple-300/40 hover:text-purple-300/60 transition-colors"
              >
                {agentName}.agora.jumpbox.tech
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-2 py-1 rounded bg-purple-500/10 text-purple-300">
                {tierName}
              </span>
              {agent.active && (
                <span className="flex items-center gap-1 text-[9px] font-mono text-[#00ff88]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 text-[10px] font-mono">
            <span className="text-white/20">Revenue to</span>
            <a
              href={`https://basescan.org/address/${agent.payTo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ff88]/60 hover:text-[#00ff88] transition-colors"
            >
              {truncAddr(agent.payTo)}
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/5">
          {(['overview', 'trade', 'api'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                tab === t
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {t === 'overview' ? 'OVERVIEW' : t === 'trade' ? 'BUY / SELL' : 'API DOCS'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && <OverviewTab agent={agent} curve={initialCurve} />}
        {tab === 'trade' && <TradeTab agent={agent} curve={initialCurve} isConnected={isConnected} address={address} />}
        {tab === 'api' && <ApiTab agentName={agentName} agent={agent} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ agent, curve }: { agent: AgentData; curve: CurveInfo | null }) {
  return (
    <div className="space-y-4">
      {/* Bonding Curve Stats */}
      {curve && (
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
          <div className="text-[9px] font-mono text-white/20 tracking-widest">BONDING CURVE</div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="PRICE" value={Number(curve.price).toFixed(6)} sub="$AGORA" color={COLORS.purple} />
            <Stat label="RESERVE" value={formatBigNum(curve.agoraReserve)} sub="$AGORA" color={COLORS.info} />
            <Stat label="SOLD" value={formatBigNum(curve.tokensSold)} sub="tokens" color={COLORS.accent} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-white/30">Graduation</span>
              <span className="text-white/50">{curve.graduationPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${curve.graduationPct}%` }} />
            </div>
            <div className="text-[8px] font-mono text-white/15">
              {curve.graduated ? 'Graduated to Uniswap V3' : `${formatBigNum(curve.agoraReserve)} / ${formatBigNum(curve.graduationAgora)} $AGORA`}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-white/30">Token</span>
            <a href={`https://basescan.org/address/${curve.token}`} target="_blank" rel="noopener noreferrer" className="text-[#00ff88]/60 hover:text-[#00ff88] transition-colors">
              {truncAddr(curve.token)}
            </a>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-white/30">Fee</span>
            <span className="text-white/50">{curve.feeBps / 100}% (80% creator / 20% protocol)</span>
          </div>
        </div>
      )}

      {!curve && !agent.hasToken && (
        <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] text-center">
          <div className="text-white/20 text-[11px]">No bonding curve token launched yet</div>
        </div>
      )}

      {/* Endpoints */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">API ENDPOINTS</div>
        {agent.endpoints.length > 0 ? (
          <div className="space-y-2">
            {agent.endpoints.filter(ep => ep.active).map((ep, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-[11px] font-mono text-white/70">/{ep.path}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${ep.paymentMode === 0 ? 'bg-purple-500/10 text-purple-300' : 'bg-[#00ff88]/10 text-[#00ff88]'}`}>
                    {ep.paymentMode === 0 ? 'CURVE' : 'DIRECT'}
                  </span>
                  <span className="text-[9px] font-mono text-white/30">{ep.priceAgora} AGORA</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-white/25 text-center py-4">No endpoints registered</div>
        )}
      </div>
    </div>
  );
}

// ─── Trade Tab ──────────────────────────────────────────────────────────────

function TradeTab({ agent, curve, isConnected, address }: {
  agent: AgentData;
  curve: CurveInfo | null;
  isConnected: boolean;
  address: `0x${string}` | undefined;
}) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const curveId = agent.curveId;

  // Read AGORA allowance for launchpad
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, LP_ADDR] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // Read AGORA balance
  const { data: agoraBalance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // Read agent token balance (for selling)
  const { data: agentTokenBalance } = useReadContract({
    address: curve?.token as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && curve ? [address] : undefined,
    query: { enabled: !!address && !!curve, refetchInterval: 15_000 },
  });

  // Read buy/sell quote
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const { data: buyQuote } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'getBuyQuote',
    args: curveId !== null && parsedAmount > BigInt(0) ? [BigInt(curveId), parsedAmount] : undefined,
    query: { enabled: curveId !== null && parsedAmount > BigInt(0) && mode === 'buy' },
  });

  const { data: sellQuote } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'getSellQuote',
    args: curveId !== null && parsedAmount > BigInt(0) ? [BigInt(curveId), parsedAmount] : undefined,
    query: { enabled: curveId !== null && parsedAmount > BigInt(0) && mode === 'sell' },
  });

  // Write contract
  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  if (!agent.hasToken || curveId === null || !curve) {
    return (
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] text-center space-y-2">
        <div className="text-white/30 text-[13px]">No token to trade</div>
        <div className="text-white/15 text-[11px]">This agent hasn&apos;t launched a bonding curve token yet.</div>
      </div>
    );
  }

  const currentAllowance = (allowance as bigint) ?? BigInt(0);
  const needsApproval = mode === 'buy' && parsedAmount > BigInt(0) && currentAllowance < parsedAmount;
  const isPending = isWriting || isConfirming;

  const quote = mode === 'buy'
    ? (buyQuote as [bigint, bigint] | undefined)
    : (sellQuote as [bigint, bigint] | undefined);
  const quoteAmount = quote ? quote[0] : null;
  const quoteFee = quote ? quote[1] : null;

  const handleApprove = () => {
    writeContract({
      address: TOKEN_ADDR,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LP_ADDR, parsedAmount],
    });
  };

  const handleBuy = () => {
    const minOut = quoteAmount ? (quoteAmount * BigInt(95)) / BigInt(100) : BigInt(0); // 5% slippage
    writeContract({
      address: LP_ADDR,
      abi: LAUNCHPAD_ABI,
      functionName: 'buy',
      args: [BigInt(curveId), parsedAmount, minOut],
    });
  };

  const handleSell = () => {
    const minOut = quoteAmount ? (quoteAmount * BigInt(95)) / BigInt(100) : BigInt(0);
    writeContract({
      address: LP_ADDR,
      abi: LAUNCHPAD_ABI,
      functionName: 'sell',
      args: [BigInt(curveId), parsedAmount, minOut],
    });
  };

  return (
    <div className="space-y-4">
      {/* Price banner */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div>
          <div className="text-[8px] font-mono text-white/20">CURRENT PRICE</div>
          <div className="text-xl font-bold text-purple-300">{Number(curve.price).toFixed(6)}</div>
          <div className="text-[9px] text-white/20">$AGORA per token</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] font-mono text-white/20">GRADUATION</div>
          <div className="text-lg font-bold text-white/60">{curve.graduationPct}%</div>
        </div>
      </div>

      {/* Buy/Sell toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/5">
        <button
          onClick={() => { setMode('buy'); reset(); }}
          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${mode === 'buy' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-white/30'}`}
        >
          BUY
        </button>
        <button
          onClick={() => { setMode('sell'); reset(); }}
          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${mode === 'sell' ? 'bg-[#ff3366]/20 text-[#ff3366]' : 'text-white/30'}`}
        >
          SELL
        </button>
      </div>

      {!isConnected ? (
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center space-y-3">
          <div className="text-white/30 text-[11px]">Connect your wallet to trade</div>
          <ConnectButton />
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
          {/* Balance */}
          <div className="flex items-center justify-between text-[10px] font-mono text-white/30">
            <span>{mode === 'buy' ? '$AGORA balance' : 'Token balance'}</span>
            <span className="text-white/50">
              {mode === 'buy'
                ? `${agoraBalance ? formatBigNum(formatEther(agoraBalance as bigint)) : '0'} AGORA`
                : `${agentTokenBalance ? formatBigNum(formatEther(agentTokenBalance as bigint)) : '0'} tokens`
              }
            </span>
          </div>

          {/* Amount input */}
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder={mode === 'buy' ? 'Amount in $AGORA' : 'Amount in tokens'}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-[14px] font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/30 transition-colors"
            />
            <button
              onClick={() => {
                if (mode === 'buy' && agoraBalance) {
                  setAmount(formatEther(agoraBalance as bigint));
                } else if (mode === 'sell' && agentTokenBalance) {
                  setAmount(formatEther(agentTokenBalance as bigint));
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono px-2 py-1 rounded bg-white/5 text-white/30 hover:text-white/50 transition-colors"
            >
              MAX
            </button>
          </div>

          {/* Quote */}
          {quoteAmount && (
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">You receive</span>
                <span className="text-white/60">
                  {formatBigNum(formatEther(quoteAmount))} {mode === 'buy' ? 'tokens' : '$AGORA'}
                </span>
              </div>
              {quoteFee && (
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-white/20">Fee</span>
                  <span className="text-white/30">{formatBigNum(formatEther(quoteFee))} {mode === 'buy' ? '$AGORA' : 'tokens'}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-white/20">Slippage</span>
                <span className="text-white/30">5% max</span>
              </div>
            </div>
          )}

          {/* Success message */}
          {isConfirmed && txHash && (
            <div className="px-3 py-2 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/20">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#00ff88]">Transaction confirmed</span>
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#00ff88]/60 hover:text-[#00ff88] transition-colors">
                  View
                </a>
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => {
              if (needsApproval) handleApprove();
              else if (mode === 'buy') handleBuy();
              else handleSell();
            }}
            disabled={!amount || parsedAmount === BigInt(0) || isPending}
            className={`w-full py-3 rounded-lg text-[12px] font-bold transition-all ${
              amount && parsedAmount > BigInt(0)
                ? mode === 'buy'
                  ? 'bg-[#00ff88]/80 text-black hover:bg-[#00ff88] active:scale-[0.98]'
                  : 'bg-[#ff3366]/80 text-white hover:bg-[#ff3366] active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            {isPending
              ? 'CONFIRMING...'
              : needsApproval
                ? 'APPROVE $AGORA'
                : mode === 'buy'
                  ? 'BUY TOKENS'
                  : 'SELL TOKENS'
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── API Docs Tab ───────────────────────────────────────────────────────────

function ApiTab({ agentName, agent }: { agentName: string; agent: AgentData }) {
  const [copied, setCopied] = useState<string | null>(null);
  const subdomainUrl = `https://${agentName}.agora.jumpbox.tech`;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Default endpoints if none registered
  const endpoints = agent.endpoints.length > 0
    ? agent.endpoints.filter(ep => ep.active)
    : [
        { path: 'api/v1/curves', priceAgora: '100', paymentMode: 0, active: true },
        { path: 'api/v1/signals', priceAgora: '200', paymentMode: 0, active: true },
        { path: 'api/v1/directory', priceAgora: '100', paymentMode: 0, active: true },
      ];

  return (
    <div className="space-y-4">
      {/* Quick Start */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">QUICK START</div>
        <div className="text-[11px] text-white/50 leading-relaxed">
          Call this agent&apos;s API via x402. The first request returns a <code className="text-purple-300/60">402 Payment Required</code> with
          payment details. Use a CDP wallet or the <code className="text-purple-300/60">@x402/client</code> SDK to auto-pay.
        </div>
      </div>

      {/* Base URL */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">BASE URL</div>
        <div className="flex items-center justify-between">
          <code className="text-[12px] font-mono text-[#00ff88]/70">{subdomainUrl}</code>
          <button
            onClick={() => copy(subdomainUrl, 'url')}
            className="text-[8px] font-mono px-2 py-1 rounded bg-white/5 text-white/30 hover:text-white/50 transition-colors"
          >
            {copied === 'url' ? 'COPIED' : 'COPY'}
          </button>
        </div>
      </div>

      {/* Free endpoint */}
      <div className="p-4 rounded-xl border border-[#00ff88]/10 bg-[#00ff88]/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono text-[#00ff88]/40 tracking-widest">FREE — AGENT INFO</div>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]/60">NO AUTH</span>
        </div>
        <CodeBlock
          id="info"
          label="curl"
          code={`curl ${subdomainUrl}/api/v1/info`}
          copied={copied}
          onCopy={copy}
        />
      </div>

      {/* Paid endpoints */}
      {endpoints.map((ep, i) => {
        const curlCode = `curl ${subdomainUrl}/${ep.path}`;
        const jsCode = `import { paymentMiddleware } from '@x402/client';

const response = await fetch('${subdomainUrl}/${ep.path}', {
  headers: paymentMiddleware.getHeaders(),
});
const data = await response.json();`;

        return (
          <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono text-white/70">GET /{ep.path}</code>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${ep.paymentMode === 0 ? 'bg-purple-500/10 text-purple-300' : 'bg-[#00ff88]/10 text-[#00ff88]'}`}>
                  {ep.paymentMode === 0 ? 'CURVE' : 'DIRECT'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-white/30">{ep.priceAgora} AGORA</span>
            </div>

            <CodeBlock id={`curl-${i}`} label="curl (returns 402)" code={curlCode} copied={copied} onCopy={copy} />
            <CodeBlock id={`js-${i}`} label="JavaScript (auto-pay)" code={jsCode} copied={copied} onCopy={copy} />
          </div>
        );
      })}

      {/* x402 Payment Flow */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">HOW x402 PAYMENTS WORK</div>
        <div className="space-y-2 text-[10px] font-mono text-white/40">
          {[
            { n: '1', t: 'Request an endpoint — server returns 402 with payment requirements' },
            { n: '2', t: 'Your client signs a USDC payment authorization (EIP-3009)' },
            { n: '3', t: 'Re-send request with payment in the header' },
            { n: '4', t: 'Server verifies payment, serves data, collects USDC' },
            { n: '5', t: 'If CURVE mode: USDC buys agent tokens on the bonding curve' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-2">
              <span className="text-purple-400/60 w-4 flex-shrink-0">{s.n}.</span>
              <span>{s.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SDK Install */}
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
        <div className="text-[9px] font-mono text-white/20 tracking-widest">INSTALL SDK</div>
        <CodeBlock
          id="install"
          label="npm"
          code="npm install @x402/client @coinbase/coinbase-sdk"
          copied={copied}
          onCopy={copy}
        />
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
      <div className="text-[8px] font-mono text-white/20 mb-1">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-[8px] text-white/15">{sub}</div>
    </div>
  );
}

function CodeBlock({ id, label, code, copied, onCopy }: {
  id: string;
  label: string;
  code: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="rounded-lg bg-black/30 border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
        <span className="text-[8px] font-mono text-white/20">{label}</span>
        <button
          onClick={() => onCopy(code, id)}
          className="text-[8px] font-mono text-white/20 hover:text-white/40 transition-colors"
        >
          {copied === id ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre className="px-3 py-2 text-[10px] font-mono text-[#00ff88]/60 overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBigNum(val: string): string {
  const num = Number(val);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num > 0) return num.toFixed(6);
  return '0';
}
