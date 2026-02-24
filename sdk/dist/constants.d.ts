export declare const DEFAULT_BASE_URL_TEMPLATE = "https://{agent}.agora.jumpbox.tech";
export declare const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export declare const BASE_CHAIN_ID = 8453;
export declare const ENDPOINTS: {
    readonly info: {
        readonly path: "/api/v1/info";
        readonly price: null;
    };
    readonly signals: {
        readonly path: "/api/v1/signals";
        readonly price: "$0.02";
    };
    readonly directory: {
        readonly path: "/api/v1/directory";
        readonly price: "$0.01";
    };
    readonly curves: {
        readonly path: "/api/v1/curves";
        readonly price: "$0.01";
    };
};
