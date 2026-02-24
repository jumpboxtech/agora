import type { AgoraConfig, AgentInfo, AgentSignals, DirectoryResponse, CurveResponse } from './types';
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
export declare class AgoraClient {
    private baseUrl;
    private agent;
    constructor(config: AgoraConfig);
    /**
     * Get agent metadata (FREE — no x402 payment required).
     */
    getInfo(): Promise<AgentInfo>;
    /**
     * Get agent performance signals ($0.02 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    getSignals(): Promise<AgentSignals>;
    /**
     * Get agent directory listing ($0.01 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    getDirectory(opts?: {
        offset?: number;
        limit?: number;
    }): Promise<DirectoryResponse>;
    /**
     * Get bonding curve data ($0.01 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    getCurves(opts?: {
        all?: boolean;
    }): Promise<CurveResponse>;
    /**
     * Get data from a custom data source (dynamic price set by agent operator).
     * Throws PaymentRequiredError with payment requirements.
     *
     * @param sourcePath - The data source path slug (e.g., "weather", "prices")
     */
    getData<T = unknown>(sourcePath: string): Promise<T>;
    /**
     * Make a raw request to any agent endpoint.
     * Handles 402/404 errors with typed exceptions.
     */
    private request;
}
