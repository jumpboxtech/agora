"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraClient = void 0;
const errors_1 = require("./errors");
const constants_1 = require("./constants");
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
class AgoraClient {
    baseUrl;
    agent;
    constructor(config) {
        this.agent = config.agent;
        this.baseUrl = config.baseUrl || constants_1.DEFAULT_BASE_URL_TEMPLATE.replace('{agent}', config.agent);
        // Strip trailing slash
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
    }
    /**
     * Get agent metadata (FREE — no x402 payment required).
     */
    async getInfo() {
        return this.request(constants_1.ENDPOINTS.info.path);
    }
    /**
     * Get agent performance signals ($0.02 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    async getSignals() {
        return this.request(constants_1.ENDPOINTS.signals.path);
    }
    /**
     * Get agent directory listing ($0.01 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    async getDirectory(opts) {
        const params = new URLSearchParams();
        if (opts?.offset)
            params.set('offset', String(opts.offset));
        if (opts?.limit)
            params.set('limit', String(opts.limit));
        const query = params.toString();
        return this.request(constants_1.ENDPOINTS.directory.path + (query ? `?${query}` : ''));
    }
    /**
     * Get bonding curve data ($0.01 USDC).
     * Throws PaymentRequiredError with payment requirements.
     */
    async getCurves(opts) {
        const query = opts?.all ? '?all=true' : '';
        return this.request(constants_1.ENDPOINTS.curves.path + query);
    }
    /**
     * Get data from a custom data source (dynamic price set by agent operator).
     * Throws PaymentRequiredError with payment requirements.
     *
     * @param sourcePath - The data source path slug (e.g., "weather", "prices")
     */
    async getData(sourcePath) {
        return this.request(`/api/v1/data/${sourcePath}`);
    }
    /**
     * Make a raw request to any agent endpoint.
     * Handles 402/404 errors with typed exceptions.
     */
    async request(path) {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url);
        if (res.status === 402) {
            const requirementsHeader = res.headers.get('payment-required');
            let requirements = null;
            if (requirementsHeader) {
                try {
                    requirements = JSON.parse(typeof atob !== 'undefined'
                        ? atob(requirementsHeader)
                        : Buffer.from(requirementsHeader, 'base64').toString());
                }
                catch {
                    // Couldn't parse requirements
                }
            }
            throw new errors_1.PaymentRequiredError(requirements);
        }
        if (res.status === 404) {
            throw new errors_1.AgentNotFoundError(this.agent);
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new errors_1.AgoraError(`Request failed: ${res.status} ${res.statusText}`, res.status, body);
        }
        return res.json();
    }
}
exports.AgoraClient = AgoraClient;
