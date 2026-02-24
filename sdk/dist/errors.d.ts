import type { PaymentRequirements } from './types';
export declare class AgoraError extends Error {
    statusCode: number;
    response?: unknown;
    constructor(message: string, statusCode: number, response?: unknown);
}
/**
 * Thrown when an endpoint requires x402 payment.
 * Contains the payment requirements needed to fulfill the request.
 */
export declare class PaymentRequiredError extends AgoraError {
    requirements: PaymentRequirements | null;
    constructor(requirements: PaymentRequirements | null);
}
export declare class AgentNotFoundError extends AgoraError {
    constructor(agent: string);
}
