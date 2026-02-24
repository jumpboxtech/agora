'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DataSource {
  id: string;
  type: 'api' | 'url' | 'db';
  name: string;
  path: string;
  price: string;
  createdAt: number;
  url?: string;
  headers?: string;
  dbConnectionString?: string;
  dbQuery?: string;
  dbType?: 'postgres' | 'mysql';
}

type SourceType = 'api' | 'url' | 'db';

// ─── Theme ──────────────────────────────────────────────────────────────────

const COLORS = {
  accent: '#00ff88',
  purple: '#a855f7',
  info: '#38bdf8',
  danger: '#ff3366',
  warn: '#ffaa00',
  muted: '#6b6b80',
};

const TYPE_COLORS: Record<SourceType, string> = {
  api: COLORS.purple,
  url: COLORS.info,
  db: COLORS.warn,
};

const TYPE_LABELS: Record<SourceType, string> = {
  api: 'API',
  url: 'URL',
  db: 'DATABASE',
};

const PRICE_OPTIONS = ['$0.005', '$0.01', '$0.02', '$0.05', '$0.10'];

// ─── Components ─────────────────────────────────────────────────────────────

function Badge({ type }: { type: SourceType }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-[8px] font-mono tracking-wider font-bold"
      style={{ background: `${TYPE_COLORS[type]}20`, color: TYPE_COLORS[type], border: `1px solid ${TYPE_COLORS[type]}30` }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

function HeaderEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (h: Record<string, string>) => void;
}) {
  const entries = Object.entries(headers);

  return (
    <div className="space-y-1.5">
      <div className="text-[8px] font-mono tracking-wider text-white/30">HEADERS</div>
      {entries.map(([key, value], i) => (
        <div key={i} className="flex gap-1.5">
          <input
            className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
            placeholder="Key"
            value={key}
            onChange={(e) => {
              const next = { ...headers };
              delete next[key];
              next[e.target.value] = value;
              onChange(next);
            }}
          />
          <input
            className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
            placeholder="Value"
            value={value}
            onChange={(e) => onChange({ ...headers, [key]: e.target.value })}
          />
          <button
            onClick={() => {
              const next = { ...headers };
              delete next[key];
              onChange(next);
            }}
            className="px-2 text-[10px] text-red-400/60 hover:text-red-400"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...headers, '': '' })}
        className="text-[9px] font-mono text-purple-400/60 hover:text-purple-400"
      >
        + Add Header
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ConfigureClient() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<SourceType>('url');
  const [formName, setFormName] = useState('');
  const [formPath, setFormPath] = useState('');
  const [formPrice, setFormPrice] = useState('$0.01');
  const [formUrl, setFormUrl] = useState('');
  const [formHeaders, setFormHeaders] = useState<Record<string, string>>({});
  const [formDbType, setFormDbType] = useState<'postgres' | 'mysql'>('postgres');
  const [formDbConn, setFormDbConn] = useState('');
  const [formDbQuery, setFormDbQuery] = useState('');
  const [testResult, setTestResult] = useState<{ status: number; preview: unknown } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Fetch data sources
  const { data: sources, isLoading } = useQuery<DataSource[]>({
    queryKey: ['datasources', address],
    queryFn: async () => {
      if (!address) return [];
      const r = await fetch(`/api/agents/datasources?address=${address}`);
      const d = await r.json();
      return d.sources || [];
    },
    enabled: !!address,
    refetchInterval: 30_000,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch('/api/agents/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed to create');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/agents/datasources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed to update');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/agents/datasources/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!r.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['datasources'] }),
  });

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormType('url');
    setFormName('');
    setFormPath('');
    setFormPrice('$0.01');
    setFormUrl('');
    setFormHeaders({});
    setFormDbType('postgres');
    setFormDbConn('');
    setFormDbQuery('');
    setTestResult(null);
  }, []);

  const handleSubmit = () => {
    const body: Record<string, unknown> = {
      address,
      type: formType,
      name: formName,
      path: formPath,
      price: formPrice,
    };

    if (formType === 'api' || formType === 'url') {
      body.url = formUrl;
    }
    if (formType === 'api' && Object.keys(formHeaders).length > 0) {
      body.headers = formHeaders;
    }
    if (formType === 'db') {
      body.dbType = formDbType;
      body.dbConnectionString = formDbConn;
      body.dbQuery = formDbQuery;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleEdit = (source: DataSource) => {
    setEditingId(source.id);
    setFormType(source.type);
    setFormName(source.name);
    setFormPath(source.path);
    setFormPrice(source.price);
    setFormUrl(source.url || '');
    setFormHeaders({});
    setFormDbType(source.dbType || 'postgres');
    setFormDbConn('');
    setFormDbQuery(source.dbQuery || '');
    setShowForm(true);
    setTestResult(null);
  };

  const handleTest = async (sourceId: string) => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/agents/datasources/${sourceId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const d = await r.json();
      setTestResult(d);
    } catch {
      setTestResult({ status: 500, preview: { error: 'Test failed' } });
    } finally {
      setTestLoading(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error || updateMutation.error;

  return (
    <div className="min-h-[100dvh] w-full bg-surface relative overflow-auto">
      <div className="scanline" />
      <div className="noise" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono tracking-[0.3em] text-purple-400/60 mb-1">AGENT CONFIGURATION</div>
            <h1 className="text-xl font-bold tracking-tight text-white">DATA SOURCES</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Connect APIs, URLs, and databases to your agent</p>
          </div>
          <Link
            href="/agents"
            className="px-3 py-1.5 rounded-lg text-[9px] font-mono tracking-wider text-white/30 border border-white/10 hover:text-white/50 hover:border-white/20 transition-all"
          >
            BACK
          </Link>
        </div>

        {/* Connect Wallet */}
        {!isConnected && (
          <div className="p-6 rounded-xl bg-surface-card border border-white/5 text-center space-y-3">
            <p className="text-[13px] text-white/40">Connect your wallet to manage data sources</p>
            <ConnectButton />
          </div>
        )}

        {isConnected && (
          <>
            {/* Source List */}
            {isLoading ? (
              <div className="text-center py-8 text-white/20 text-[10px] font-mono animate-pulse">Loading data sources...</div>
            ) : !sources?.length && !showForm ? (
              <div className="p-8 rounded-xl bg-surface-card border border-white/5 text-center space-y-3">
                <div className="text-lg font-bold text-white/20">No Data Sources</div>
                <p className="text-[11px] text-white/30">Add your first data source to create an x402-gated endpoint</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 rounded-lg text-[10px] font-mono tracking-wider font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
                >
                  + ADD DATA SOURCE
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sources?.map((source) => (
                  <div
                    key={source.id}
                    className="p-3 rounded-xl bg-surface-card border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge type={source.type} />
                          <span className="text-[12px] font-bold text-white/80 truncate">{source.name}</span>
                        </div>
                        <div className="text-[9px] font-mono text-white/20 mb-1">
                          /api/v1/data/{source.path}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono" style={{ color: COLORS.accent }}>{source.price}</span>
                          {source.url && source.url !== '***' && (
                            <span className="text-[9px] font-mono text-white/15 truncate max-w-[200px]">{source.url}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleTest(source.id)}
                          disabled={testLoading}
                          className="px-2 py-1 rounded text-[8px] font-mono text-info/60 border border-info/20 hover:text-info hover:border-info/40 transition-all disabled:opacity-30"
                        >
                          TEST
                        </button>
                        <button
                          onClick={() => handleEdit(source)}
                          className="px-2 py-1 rounded text-[8px] font-mono text-white/30 border border-white/10 hover:text-white/50 hover:border-white/20 transition-all"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(source.id)}
                          className="px-2 py-1 rounded text-[8px] font-mono text-red-400/40 border border-red-400/10 hover:text-red-400 hover:border-red-400/30 transition-all"
                        >
                          DEL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full p-3 rounded-xl border border-dashed border-white/10 text-[10px] font-mono text-white/20 hover:text-white/40 hover:border-white/20 transition-all"
                  >
                    + ADD DATA SOURCE
                  </button>
                )}
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div className="p-3 rounded-xl bg-surface-card border border-info/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[8px] font-mono tracking-wider text-info/60">TEST RESULT</span>
                  <span className={`text-[9px] font-mono font-bold ${testResult.status === 200 ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.status}
                  </span>
                  <button onClick={() => setTestResult(null)} className="ml-auto text-[9px] text-white/20 hover:text-white/40">dismiss</button>
                </div>
                <pre className="text-[9px] font-mono text-white/40 overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(testResult.preview, null, 2)}
                </pre>
              </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
              <div className="p-4 rounded-xl bg-surface-card border border-purple-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-mono tracking-wider text-purple-400/60">
                    {editingId ? 'EDIT DATA SOURCE' : 'NEW DATA SOURCE'}
                  </div>
                  <button onClick={resetForm} className="text-[9px] text-white/20 hover:text-white/40">cancel</button>
                </div>

                {/* Type Selector */}
                <div className="flex gap-1.5">
                  {(['url', 'api', 'db'] as SourceType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFormType(t)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-[9px] font-mono tracking-wider font-bold transition-all ${
                        formType === t
                          ? 'border'
                          : 'text-white/25 border border-white/5 hover:text-white/40'
                      }`}
                      style={formType === t ? { background: `${TYPE_COLORS[t]}15`, color: TYPE_COLORS[t], borderColor: `${TYPE_COLORS[t]}40` } : undefined}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                {/* Name + Path */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">NAME</div>
                    <input
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
                      placeholder="Weather API"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">ENDPOINT PATH</div>
                    <input
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
                      placeholder="weather"
                      value={formPath}
                      onChange={(e) => setFormPath(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      disabled={!!editingId}
                    />
                    {formPath && (
                      <div className="text-[8px] font-mono text-white/15 mt-0.5">
                        /api/v1/data/{formPath}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">PRICE PER REQUEST</div>
                  <div className="flex gap-1.5">
                    {PRICE_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setFormPrice(p)}
                        className={`px-2.5 py-1 rounded text-[9px] font-mono transition-all ${
                          formPrice === p
                            ? 'bg-accent/15 text-accent border border-accent/30'
                            : 'text-white/25 border border-white/5 hover:text-white/40'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <input
                      className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-white/50 focus:border-purple-500/50 outline-none"
                      placeholder="Custom"
                      value={PRICE_OPTIONS.includes(formPrice) ? '' : formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                    />
                  </div>
                </div>

                {/* URL field (api + url types) */}
                {(formType === 'api' || formType === 'url') && (
                  <div>
                    <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">URL</div>
                    <input
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
                      placeholder="https://api.example.com/v1/data"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                    />
                  </div>
                )}

                {/* Headers (api type) */}
                {formType === 'api' && (
                  <HeaderEditor headers={formHeaders} onChange={setFormHeaders} />
                )}

                {/* DB fields */}
                {formType === 'db' && (
                  <>
                    <div>
                      <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">DATABASE TYPE</div>
                      <div className="flex gap-1.5">
                        {(['postgres', 'mysql'] as const).map((dt) => (
                          <button
                            key={dt}
                            onClick={() => setFormDbType(dt)}
                            className={`px-3 py-1 rounded text-[9px] font-mono transition-all ${
                              formDbType === dt
                                ? 'bg-warn/15 text-warn border border-warn/30'
                                : 'text-white/25 border border-white/5 hover:text-white/40'
                            }`}
                          >
                            {dt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">CONNECTION STRING</div>
                      <input
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none"
                        placeholder="postgresql://user:pass@host:5432/db"
                        type="password"
                        value={formDbConn}
                        onChange={(e) => setFormDbConn(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-wider text-white/30 mb-1">SQL QUERY (SELECT only)</div>
                      <textarea
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 focus:border-purple-500/50 outline-none resize-y min-h-[60px]"
                        placeholder="SELECT * FROM metrics ORDER BY created_at DESC LIMIT 100"
                        value={formDbQuery}
                        onChange={(e) => setFormDbQuery(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Error */}
                {saveError && (
                  <div className="text-[10px] font-mono text-red-400">{(saveError as Error).message}</div>
                )}

                {/* Save */}
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || !formName || !formPath}
                  className="w-full py-2 rounded-lg text-[10px] font-mono tracking-wider font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-30"
                >
                  {isSaving ? 'SAVING...' : editingId ? 'UPDATE SOURCE' : 'CREATE SOURCE'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <Link href="/agents" className="text-[10px] font-mono text-purple-400/50 hover:text-purple-400 transition-colors">
            BACK TO AGENTS
          </Link>
        </div>
      </div>
    </div>
  );
}
