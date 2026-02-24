import type { PaymentRequirements } from './types';

export class AgoraError extends Error {
  public statusCode: number;
  public response?: unknown;

  constructor(message: string, statusCode: number, response?: unknown) {
    super(message);
    this.name = 'AgoraError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Thrown when an endpoint requires x402 payment.
 * Contains the payment requirements needed to fulfill the request.
 */
export class PaymentRequiredError extends AgoraError {
  public requirements: PaymentRequirements | null;

  constructor(requirements: PaymentRequirements | null) {
    super('Payment required (402)', 402, requirements);
    this.name = 'PaymentRequiredError';
    this.requirements = requirements;
  }
}

export class AgentNotFoundError extends AgoraError {
  constructor(agent: string) {
    super(`Agent not found: ${agent}`, 404);
    this.name = 'AgentNotFoundError';
  }
}
