import { Resend } from 'resend';
import type { HealthCheck } from './health';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

/**
 * Send a health alert email when data source endpoints are down.
 */
export async function sendHealthAlert(
  to: string,
  agentName: string,
  failedEndpoints: HealthCheck[],
): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.error('[email] Resend not configured');
    return false;
  }

  const endpointRows = failedEndpoints
    .map((ep) => {
      const downMins = Math.round(ep.consecutiveFailures * 15);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #1a1a2e;color:#e0e0e0;font-family:monospace;font-size:13px">${ep.name}</td>
        <td style="padding:8px;border-bottom:1px solid #1a1a2e;color:#ff3366;font-family:monospace;font-size:13px">${ep.lastError || 'Timeout'}</td>
        <td style="padding:8px;border-bottom:1px solid #1a1a2e;color:#ffaa00;font-family:monospace;font-size:13px">~${downMins} min</td>
      </tr>`;
    })
    .join('');

  const html = `
    <div style="background:#0a0a12;padding:32px;font-family:system-ui,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#0d0d1a;border:1px solid #1a1a2e;border-radius:12px;padding:24px">
        <h1 style="color:#a855f7;font-size:16px;margin:0 0 4px;font-family:monospace">AGORA HEALTH ALERT</h1>
        <p style="color:#6b6b80;font-size:12px;margin:0 0 20px">Agent: <strong style="color:#e0e0e0">${agentName}</strong></p>

        <p style="color:#ff3366;font-size:13px;margin:0 0 16px">One or more data source endpoints have been unreachable for over 1 hour.</p>

        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:8px;border-bottom:1px solid #2a2a3e;color:#6b6b80;font-size:10px;text-align:left;font-family:monospace;letter-spacing:0.1em">ENDPOINT</th>
              <th style="padding:8px;border-bottom:1px solid #2a2a3e;color:#6b6b80;font-size:10px;text-align:left;font-family:monospace;letter-spacing:0.1em">ERROR</th>
              <th style="padding:8px;border-bottom:1px solid #2a2a3e;color:#6b6b80;font-size:10px;text-align:left;font-family:monospace;letter-spacing:0.1em">DOWNTIME</th>
            </tr>
          </thead>
          <tbody>${endpointRows}</tbody>
        </table>

        <p style="color:#6b6b80;font-size:11px;margin:20px 0 0">
          Check your data sources at <a href="https://agora.jumpbox.tech/agent/configure" style="color:#a855f7">agora.jumpbox.tech/agent/configure</a>
        </p>
        <p style="color:#3a3a4e;font-size:10px;margin:8px 0 0">You will not receive another alert for these endpoints for 6 hours.</p>
      </div>
    </div>
  `;

  try {
    await client.emails.send({
      from: 'Agora <alerts@jumpbox.tech>',
      to,
      subject: `[Agora] Endpoint down: ${failedEndpoints.map((e) => e.name).join(', ')}`,
      html,
    });
    return true;
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return false;
  }
}
