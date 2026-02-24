import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { facilitator } from '@coinbase/x402';

const facilitatorClient = new HTTPFacilitatorClient(facilitator);
export const x402Server = new x402ResourceServer(facilitatorClient)
  .register('eip155:8453', new ExactEvmScheme());

// USDC on Base
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
