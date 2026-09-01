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

Both components require an `orderId`: the identifier of a real order or cart that already exists in
your own storage, with a price you control. It is forwarded in the settlement POST body and is the
only thing the endpoint prices from.

```astro
---
import { AgenticPayButton, WalletCheckout } from 'agentic-payment-x402-astro/components';
import { getOrder } from '../lib/orders';

const order = await getOrder(Astro.params.orderId!);
---

<!-- Single Button -->
<AgenticPayButton
  orderId={order.id}
  amount={order.totalUsd}
  currency="USD"
  payTo="0xYourMerchantWalletAddress..."
  network="eip155:8453"
  buttonText={`Pay $${order.totalUsd} USDC`}
  onSuccessRedirect="/onboarding/success"
/>

<!-- Full Checkout Card -->
<WalletCheckout
  title="SignalOps Retainer"
  orderId={order.id}
  amount={order.totalUsd}
  currency="USD"
  payTo="0xYourMerchantWalletAddress..."
  network="eip155:8453"
  onSuccessRedirect="/onboarding/success"
/>
```

The `amount` prop only drives what is displayed and what the shopper is asked to sign, and the
settlement endpoint may ignore or drop it entirely. It is **never** what gets settled — the endpoint
re-prices the order from `orderId` server-side (next step). `network` must be a CAIP-2 identifier
(`eip155:8453` Base, `eip155:84532` Base Sepolia) and must match the endpoint's configured network;
the components forward `network` and `asset` in the POST body so a mismatch fails as an explicit
400 rather than a silent wrong-chain signature.

### 4. Add the Settlement Endpoint (`src/pages/api/x402/settle.ts`)

`resolveOrderAmount` is **required**: everything in the POST body (`amount`, `orderId`, the signed
`accepted` requirements) is client-controlled, so the amount that gets settled must come from your
own server-side state. Without it the handler refuses to start.

`orderId` is the one body field it is safe to *look up* by — never to price by directly. Use it as a
key into your own order storage and return that record's price:

```typescript
import { createX402SettlementHandler } from 'agentic-payment-x402-astro/endpoints';
import { db } from '../../../lib/db';

/**
 * Server-side order lookup. Replace with your real storage (Postgres, D1, Stripe, a CMS...).
 * Returns null for an unknown, already-paid, or expired order so settlement is refused.
 */
async function getOrder(orderId: string) {
  const order = await db.orders.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'awaiting_payment') return null;
  return order; // { id, totalUsd: 2500, status: 'awaiting_payment' }
}

export const POST = createX402SettlementHandler({
  payTo: process.env.MERCHANT_WALLET!,
  network: 'eip155:8453',
  facilitators: ['https://facilitator.payai.network'],
  // Price in major currency units, resolved from merchant-side state only. `orderId` is used purely
  // as a lookup key — no value from the request body is ever returned as the price.
  resolveOrderAmount: async ({ orderId }) => {
    if (typeof orderId !== 'string' || orderId === '') return null;
    const order = await getOrder(orderId);
    return order?.totalUsd ?? null; // null / undefined refuses the settlement
  },
});
```

> **Never** write `resolveOrderAmount: ({ amount }) => amount` (or return any other value read out of
> the request body). That hands the price back to the client and reintroduces the pay-any-price
> vulnerability the required resolver exists to close: a shopper can then settle a $2,500 order for
> $0.01. If you have no server-side price for a request, return `null`.

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

### Security Notes — What This Library Does *Not* Do

- **Replay protection is not provided.** Each payload carries a unique EIP-3009 nonce, and the ERC-20
  contract rejects a nonce it has already consumed, but this library keeps no record of seen nonces or
  settled orders. It will happily forward the same payload to the facilitator twice, and a facilitator
  that returns a cached success would produce two fulfilled orders for one on-chain transfer. Enforce
  single-use yourself: mark the order paid inside the same transaction that fulfils it, reject
  settlement for an order not in `awaiting_payment` (as the `getOrder` example above does), and/or
  persist the authorization nonce and refuse a repeat.
- **Fulfilment is your responsibility.** A `200 { success: true }` means the transfer was broadcast and
  cross-checked; it does not fulfil, capture, or record anything on your side.
- **Post-broadcast mismatches need reconciliation.** If the facilitator settles on an unexpected
  network or for an unexpected amount, the failure is detected *after* the on-chain broadcast. The
  response then carries `requiresReconciliation: true` with `txHash` and `payer`, and the same details
  are logged at error level. Treat those as a paid-but-unfulfilled order and reconcile manually — the
  customer's funds may have moved.
- **Amounts are quantized to the asset's decimals** (6 for USDC), rounding half-up on the first dropped
  digit. A price that rounds to zero atomic units is refused rather than settled for nothing.

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
