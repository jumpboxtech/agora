// notifications.ts — Agora notification categories + Neynar send helper

// ─── Categories ──────────────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = {
  system: {
    id: 'system' as const,
    label: 'System',
    description: 'App updates, maintenance',
    defaultEnabled: true,
    canDisable: false,
  },
  progress: {
    id: 'progress' as const,
    label: 'Progress',
    description: 'Tier unlocks, API deploys',
    defaultEnabled: true,
    canDisable: true,
  },
  rewards: {
    id: 'rewards' as const,
    label: 'Rewards',
    description: '$AGORA claimed, quests complete',
    defaultEnabled: true,
    canDisable: true,
  },
  reminder: {
    id: 'reminder' as const,
    label: 'Reminders',
    description: 'Daily check-in reminder',
    defaultEnabled: true,
    canDisable: true,
  },
  agents: {
    id: 'agents' as const,
    label: 'Agents',
    description: 'Agent built API, agent idle',
    defaultEnabled: false,
    canDisable: true,
  },
} as const;

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

export interface NotificationPreferences {
  system: boolean;
  progress: boolean;
  rewards: boolean;
  reminder: boolean;
  agents: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  system: true,
  progress: true,
  rewards: true,
  reminder: true,
  agents: false,
};

// ─── Neynar Send Helper (server-side only) ───────────────────────────────────

const APP_URL = 'https://agora.jumpbox.tech';

export async function sendFarcasterNotification(opts: {
  targetFids: number[];
  title: string;
  body: string;
  targetUrl?: string;
  uuid?: string;
}): Promise<{ success: number; failure: number }> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.error('[notifications] NEYNAR_API_KEY not set');
    return { success: 0, failure: opts.targetFids.length };
  }

  if (opts.targetFids.length === 0) {
    return { success: 0, failure: 0 };
  }

  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/frame/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        target_fids: opts.targetFids,
        notification: {
          title: opts.title.slice(0, 32),
          body: opts.body.slice(0, 128),
          target_url: opts.targetUrl || APP_URL,
          uuid: opts.uuid || crypto.randomUUID(),
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[notifications] Neynar send error:', res.status, err);
      return { success: 0, failure: opts.targetFids.length };
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      success: (data.success_count as number) ?? opts.targetFids.length,
      failure: (data.failure_count as number) ?? 0,
    };
  } catch (err) {
    console.error('[notifications] send error:', err);
    return { success: 0, failure: opts.targetFids.length };
  }
}
