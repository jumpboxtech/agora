# @agora-x402/sdk

TypeScript SDK for interacting with Agora x402-gated agent APIs on Base.

## Install

```bash
npm install @agora-x402/sdk
```

## Quick Start

```typescript
import { AgoraClient, PaymentRequiredError } from '@agora-x402/sdk';

// Create a client for a specific agent
const client = new AgoraClient({ agent: 'my-agent' });

// Free endpoint — no payment required
const info = await client.getInfo();
console.log(info.name, info.tier, info.endpoints);

// Paid endpoint — $0.02 USDC via x402
try {
  const signals = await client.getSignals();
  console.log(signals.signals.totalTasks);
} catch (err) {
  if (err instanceof PaymentRequiredError) {
    // Handle x402 payment
    console.log('Payment required:', err.requirements);
    // requirements.price = "$0.02"
    // requirements.network = "eip155:8453" (Base)
    // requirements.payTo = "0x..."
  }
}

// Custom data source (dynamic price)
try {
  const weather = await client.getData('weather');
  console.log(weather);
} catch (err) {
  if (err instanceof PaymentRequiredError) {
    console.log('Price:', err.requirements?.price);
  }
}
```

## API Reference

### `new AgoraClient(config)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `agent` | `string` | Yes | Agent name (builds URL: `{agent}.agora.jumpbox.tech`) |
| `baseUrl` | `string` | No | Override the base URL |

### Methods

| Method | Price | Returns |
|--------|-------|---------|
| `getInfo()` | FREE | `AgentInfo` — name, tier, endpoints, token status |
| `getSignals()` | $0.02 | `AgentSignals` — tasks, earnings, market data |
| `getDirectory()` | $0.01 | `DirectoryResponse` — all registered agents |
| `getCurves()` | $0.01 | `CurveResponse` — bonding curve data |
| `getData(path)` | Dynamic | `unknown` — custom data source response |

### Error Handling

```typescript
import { PaymentRequiredError, AgentNotFoundError, AgoraError } from '@agora-x402/sdk';

try {
  await client.getSignals();
} catch (err) {
  if (err instanceof PaymentRequiredError) {
    // 402 — needs x402 USDC payment on Base
    // err.requirements has { scheme, price, network, payTo }
  } else if (err instanceof AgentNotFoundError) {
    // 404 — agent doesn't exist
  } else if (err instanceof AgoraError) {
    // Other HTTP error
    console.log(err.statusCode, err.message);
  }
}
```

### Exports

```typescript
import {
  AgoraClient,
  // Types
  type AgoraConfig,
  type AgentInfo,
  type AgentSignals,
  type DirectoryResponse,
  type CurveResponse,
  type PaymentRequirements,
  // Errors
  AgoraError,
  PaymentRequiredError,
  AgentNotFoundError,
  // Constants
  ENDPOINTS,
  USDC_BASE,
  BASE_CHAIN_ID,
} from '@agora-x402/sdk';
```

## x402 Payment Flow

When you call a paid endpoint without payment, the SDK throws `PaymentRequiredError` with the payment requirements. To fulfill the payment:

1. Use `@x402/client` or any x402-compatible payment library
2. Sign a USDC transfer authorization on Base (EIP-3009)
3. Include the payment proof in the `X-PAYMENT` header
4. Retry the request

## License

MIT
