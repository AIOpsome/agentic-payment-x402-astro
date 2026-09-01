# Agentic Pay for Astro (`agentic-payment-x402-astro`)

[![npm version](https://img.shields.io/npm/v/agentic-payment-x402-astro.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/agentic-payment-x402-astro)
[![npm version core](https://img.shields.io/npm/v/agentic-payment-x402-core.svg?style=flat-square&color=indigo)](https://www.npmjs.com/package/agentic-payment-x402-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Agentic Pay for Astro** brings receive-only stablecoin payments (USDC on Base/Ethereum) and the open **x402 payment protocol** to Astro and modern TypeScript web applications.

It empowers storefronts, agencies, and SaaS platforms to accept payments from both **human wallet shoppers** (via one-click connect and sign) and **autonomous AI shopping agents** (via HTTP 402 negotiation).

---

## Packages in this Monorepo

| Package | Purpose | Target Environment |
|---|---|---|
| [`agentic-payment-x402-core`](./packages/agentic-payment-x402-core) | Universal cryptographic, wallet-signing, and settlement engine | Browser, Node.js, Bun, Deno, Edge |
| [`agentic-payment-x402-astro`](./packages/agentic-payment-x402-astro) | Astro Integration, HTTP 402 AI Agent Middleware, and UI Components | Astro 4 / 5 SSR & Static Stores |

---

## Quick Start (Astro)

### 1. Install

```bash
pnpm add agentic-payment-x402-astro agentic-payment-x402-core
```

### 2. Configure Integration in `astro.config.mjs`

```typescript
import { defineConfig } from 'astro/config';
import agenticPay from 'agentic-payment-x402-astro';

export default defineConfig({
  integrations: [
    agenticPay({
      payTo: '0xYourMerchantWalletAddress...',
      network: 'eip155:8453', // Base Mainnet (or eip155:84532 for Base Sepolia)
      facilitators: [
        'https://facilitator.payai.network',
        {
          url: 'https://api.cdp.coinbase.com/platform/v2/x402',
          apiKeyId: process.env.CDP_API_KEY_ID,
          apiKeySecret: process.env.CDP_API_KEY_SECRET,
        },
      ],
      protectedRoutes: {
        '/api/premium-report': 5.0, // $5.00 USDC per API request
      },
    }),
  ],
});
```

### 3. Add Checkout Button to Any Page

```astro
---
import { AgenticPayButton, WalletCheckout } from 'agentic-payment-x402-astro/components';
---

<!-- Single Button -->
<AgenticPayButton
  amount={2500}
  currency="USD"
  payTo="0xYourMerchantWalletAddress..."
  buttonText="Pay $2,500 USDC"
  onSuccessRedirect="/onboarding/success"
/>

<!-- Full Checkout Card -->
<WalletCheckout
  title="SignalOps Retainer"
  amount={2500}
  currency="USD"
  payTo="0xYourMerchantWalletAddress..."
  onSuccessRedirect="/onboarding/success"
/>
```

The `amount` prop only drives what the shopper is asked to sign. It is **never** what gets settled —
the settlement endpoint prices the order server-side (next step).

### 4. Add the Settlement Endpoint (`src/pages/api/x402/settle.ts`)

`resolveOrderAmount` is **required**: everything in the POST body (`amount`, `orderId`, the signed
`accepted` requirements) is client-controlled, so the amount that gets settled must come from your
own server-side state. Without it the handler refuses to start.

```typescript
import { createX402SettlementHandler } from 'agentic-payment-x402-astro/endpoints';

export const POST = createX402SettlementHandler({
  payTo: process.env.MERCHANT_WALLET!,
  facilitators: ['https://facilitator.payai.network'],
  // Price in major currency units, resolved from merchant-side state only.
  resolveOrderAmount: async ({ orderId }) => {
    const order = await getOrder(String(orderId));
    return order?.totalUsd ?? null; // null / undefined refuses the settlement
  },
});
```

A payload signed for less than the resolved price is rejected with `Amount mismatch` before the
facilitator is ever contacted.

### 5. Enable AI Agent Protection via Middleware (`src/middleware.ts`)

```typescript
import { defineMiddleware } from 'astro:middleware';
import { createX402Middleware } from 'agentic-payment-x402-astro/middleware';

export const onRequest = createX402Middleware({
  payTo: process.env.MERCHANT_WALLET!,
  protectedRoutes: {
    '/api/services/audit': 1200, // Autonomous agents receive 402, sign, and pay $1,200 USDC
  },
});
```

---

## Architecture & Security Floor

1. **Receive-Only & Self-Custody**: The merchant server never handles private keys. All funds settle directly to your configured EVM wallet address.
2. **EIP-3009 Gasless Signatures**: Shoppers sign an EIP-712 `TransferWithAuthorization` message without paying gas fees; the facilitator broadcasts the settlement on-chain.
3. **Multi-Facilitator Failover**: Automatically attempts settlement against PayAI and Coinbase CDP with automatic fallback.
4. **Idempotency & Nonce Management**: Cryptographically unique 32-byte nonces ensure zero duplicate charges.
5. **Server-Side Pricing Only**: The settlement endpoint requires `resolveOrderAmount` and never reads a price from the request body, so a tampered `amount` cannot buy a $2,500 order for $0.01.
6. **Fail-Closed Configuration**: Unknown networks, unusable route prices, and colliding protected-route keys raise explicit errors rather than silently defaulting to Base mainnet USDC.

---

## Development

```bash
# Install dependencies
pnpm install

# Run Vitest test suite
pnpm test

# Typecheck
pnpm typecheck

# Build bundles
pnpm build
```

---

## License

MIT © [AIOpsome](https://aiopsome.com)
