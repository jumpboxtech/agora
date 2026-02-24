"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentNotFoundError = exports.PaymentRequiredError = exports.AgoraError = void 0;
class AgoraError extends Error {
    statusCode;
    response;
    constructor(message, statusCode, response) {
        super(message);
        this.name = 'AgoraError';
        this.statusCode = statusCode;
        this.response = response;
    }
}
exports.AgoraError = AgoraError;
/**
 * Thrown when an endpoint requires x402 payment.
 * Contains the payment requirements needed to fulfill the request.
 */
class PaymentRequiredError extends AgoraError {
    requirements;
    constructor(requirements) {
        super('Payment required (402)', 402, requirements);
        this.name = 'PaymentRequiredError';
        this.requirements = requirements;
    }
}
exports.PaymentRequiredError = PaymentRequiredError;
class AgentNotFoundError extends AgoraError {
    constructor(agent) {
        super(`Agent not found: ${agent}`, 404);
        this.name = 'AgentNotFoundError';
    }
}
exports.AgentNotFoundError = AgentNotFoundError;
