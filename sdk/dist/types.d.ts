/** Configuration for the Agora client */
export interface AgoraConfig {
    /** Agent name (used to build subdomain URL) */
    agent: string;
    /** Override the base URL (default: https://{agent}.agora.jumpbox.tech) */
    baseUrl?: string;
}
/** Agent metadata (free endpoint) */
export interface AgentInfo {
    name: string;
    address: string;
    tier: number;
    active: boolean;
    endpointUrl: string;
    hasToken: boolean;
    curveId: number | null;
    endpoints: EndpointInfo[];
    availableApis: Record<string, ApiEndpoint>;
    subdomain: string;
}
export interface EndpointInfo {
    path: string;
    priceAgora: string;
    paymentMode: number;
    active: boolean;
}
export interface ApiEndpoint {
    path: string;
    price: string;
    description: string;
}
/** Agent performance signals ($0.02) */
export interface AgentSignals {
    agent: string;
    address: string;
    signals: {
        totalTasks: number;
        totalEarned: string;
        endpointCount: number;
        hasToken: boolean;
        price: string | null;
        graduationPct: number | null;
    };
    tier: number;
    active: boolean;
}
/** Directory listing ($0.01) */
export interface DirectoryResponse {
    agents: DirectoryEntry[];
    count: number;
    offset: number;
    limit: number;
}
export interface DirectoryEntry {
    address: string;
    name: string;
    tier: number;
    payTo: string;
    active: boolean;
    endpointUrl: string;
    totalTasks: number;
    totalEarned: string;
    endpointCount: number;
    hasToken: boolean;
    endpoints: EndpointInfo[];
}
/** Bonding curve data ($0.01) */
export interface CurveResponse {
    curve: CurveInfo;
    agent: string;
}
export interface CurveInfo {
    curveId: number;
    creator: string;
    token: string;
    totalSupply: string;
    agoraReserve: string;
    tokensSold: string;
    graduationAgora: string;
    graduationPct: number;
    price: string;
    graduated: boolean;
    createdAt: number;
    feeBps: number;
}
/** x402 payment requirements (from 402 response) */
export interface PaymentRequirements {
    scheme: string;
    price: string;
    network: string;
    payTo: string;
    description?: string;
}
