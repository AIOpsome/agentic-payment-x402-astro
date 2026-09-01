# agentic-payment-x402-core

Universal TypeScript/JavaScript cryptographic, client-signing, and server-settlement engine for the **x402 Payment Protocol** (v2).

## Features

- **Browser / Client**: EIP-1193 wallet discovery, Base mainnet/sepolia chain switching, and EIP-712/EIP-3009 signature generation.
- **Server / Backend**: Facilitator client (`/verify` and `/settle`), Coinbase CDP and PayAI authentication, payload validator, and float-safe atomic unit conversions.
- **Universal**: Zero framework lock-in. Runs in Astro, Next.js, Remix, Vite, SvelteKit, Express, Node.js, Bun, and Cloudflare Workers.

## Installation

```bash
npm install agentic-payment-x402-core
```

## Client Usage (Browser)

```typescript
import { signPaymentAuthorization, scaleToAssetUnits } from 'agentic-payment-x402-core/client';

const payload = await signPaymentAuthorization({
  requirements: {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: scaleToAssetUnits(10.50), // $10.50 USDC -> '10500000'
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xMerchantWalletAddress...',
  },
});
```

## Server Usage (Node / SSR)

```typescript
import { FacilitatorClient, validatePaymentPayload } from 'agentic-payment-x402-core/server';

const client = new FacilitatorClient([
  'https://facilitator.payai.network',
  {
    url: 'https://api.cdp.coinbase.com/platform/v2/x402',
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  },
]);

const validation = validatePaymentPayload(payload, requirements);
if (!validation.valid) throw new Error(validation.error);

const result = await client.settle(payload, requirements);
console.log('Tx Hash:', result.txHash);
```

## License

MIT © [AIOpsome](https://aiopsome.com)
