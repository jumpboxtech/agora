export const DEFAULT_BASE_URL_TEMPLATE = 'https://{agent}.agora.jumpbox.tech';

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN_ID = 8453;

export const ENDPOINTS = {
  info: { path: '/api/v1/info', price: null },
  signals: { path: '/api/v1/signals', price: '$0.02' },
  directory: { path: '/api/v1/directory', price: '$0.01' },
  curves: { path: '/api/v1/curves', price: '$0.01' },
} as const;
