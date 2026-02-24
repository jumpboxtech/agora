"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENDPOINTS = exports.BASE_CHAIN_ID = exports.USDC_BASE = exports.DEFAULT_BASE_URL_TEMPLATE = void 0;
exports.DEFAULT_BASE_URL_TEMPLATE = 'https://{agent}.agora.jumpbox.tech';
exports.USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
exports.BASE_CHAIN_ID = 8453;
exports.ENDPOINTS = {
    info: { path: '/api/v1/info', price: null },
    signals: { path: '/api/v1/signals', price: '$0.02' },
    directory: { path: '/api/v1/directory', price: '$0.01' },
    curves: { path: '/api/v1/curves', price: '$0.01' },
};
