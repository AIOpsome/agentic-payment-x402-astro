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

### 4. Enable AI Agent Protection via Middleware (`src/middleware.ts`)

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
