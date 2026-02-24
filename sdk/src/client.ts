import type {
  AgoraConfig,
  AgentInfo,
  AgentSignals,
  DirectoryResponse,
  CurveResponse,
  PaymentRequirements,
} from './types';
import { AgoraError, PaymentRequiredError, AgentNotFoundError } from './errors';
import { DEFAULT_BASE_URL_TEMPLATE, ENDPOINTS } from './constants';

/**
 * Client for interacting with Agora x402-gated agent APIs.
 *
 * @example
 * ```typescript
 * const client = new AgoraClient({ agent: 'my-agent' });
 *
 * // Free endpoint
 * const info = await client.getInfo();
 *
 * // Paid endpoint ($0.02 USDC) — throws PaymentRequiredError with requirements
 * try {
 *   const signals = await client.getSignals();
 * } catch (err) {
 *   if (err instanceof PaymentRequiredError) {
 *     console.log('Payment needed:', err.requirements);
 *   }
 * }
 * ```
 */
export class AgoraClient {
  private baseUrl: string;
  private agent: string;

  constructor(config: AgoraConfig) {
    this.agent = config.agent;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL_TEMPLATE.replace('{agent}', config.agent);
    // Strip trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * Get agent metadata (FREE — no x402 payment required).
   */
  async getInfo(): Promise<AgentInfo> {
    return this.request<AgentInfo>(ENDPOINTS.info.path);
  }

  /**
   * Get agent performance signals ($0.02 USDC).
   * Throws PaymentRequiredError with payment requirements.
   */
  async getSignals(): Promise<AgentSignals> {
    return this.request<AgentSignals>(ENDPOINTS.signals.path);
  }

  /**
   * Get agent directory listing ($0.01 USDC).
   * Throws PaymentRequiredError with payment requirements.
   */
  async getDirectory(opts?: { offset?: number; limit?: number }): Promise<DirectoryResponse> {
    const params = new URLSearchParams();
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.limit) params.set('limit', String(opts.limit));
    const query = params.toString();
    return this.request<DirectoryResponse>(ENDPOINTS.directory.path + (query ? `?${query}` : ''));
  }

  /**
   * Get bonding curve data ($0.01 USDC).
   * Throws PaymentRequiredError with payment requirements.
   */
  async getCurves(opts?: { all?: boolean }): Promise<CurveResponse> {
    const query = opts?.all ? '?all=true' : '';
    return this.request<CurveResponse>(ENDPOINTS.curves.path + query);
  }

  /**
   * Get data from a custom data source (dynamic price set by agent operator).
   * Throws PaymentRequiredError with payment requirements.
   *
   * @param sourcePath - The data source path slug (e.g., "weather", "prices")
   */
  async getData<T = unknown>(sourcePath: string): Promise<T> {
    return this.request<T>(`/api/v1/data/${sourcePath}`);
  }

  /**
   * Make a raw request to any agent endpoint.
   * Handles 402/404 errors with typed exceptions.
   */
  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url);

    if (res.status === 402) {
      const requirementsHeader = res.headers.get('payment-required');
      let requirements: PaymentRequirements | null = null;

      if (requirementsHeader) {
        try {
          requirements = JSON.parse(
            typeof atob !== 'undefined'
              ? atob(requirementsHeader)
              : Buffer.from(requirementsHeader, 'base64').toString(),
          );
        } catch {
          // Couldn't parse requirements
        }
      }

      throw new PaymentRequiredError(requirements);
    }

    if (res.status === 404) {
      throw new AgentNotFoundError(this.agent);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AgoraError(`Request failed: ${res.status} ${res.statusText}`, res.status, body);
    }

    return res.json() as Promise<T>;
  }
}
