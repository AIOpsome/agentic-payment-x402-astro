---
"agentic-payment-x402-core": minor
"agentic-payment-x402-astro": minor
---

Fix security, validation, and protocol compliance issues (fixes #1, #2, #3, #4, #5, #6, #7):
- `createX402SettlementHandler` now **requires** `resolveOrderAmount` and never reads a price from the request body (`amount`, `orderId`, or the signed `accepted` requirements), closing the pay-any-price bypass that was reachable in the previously documented default configuration (#1).
- Spec-compliant x402 v2 wire transport: `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` are each set exactly once (a duplicated header was comma-joined and broke strict `atob()` clients), the 402 body is `{}`, and base64 encoding uses Web-standard APIs so the middleware still runs on Cloudflare/Deno/Vercel edge adapters (#2).
- Unknown networks raise a configuration error instead of silently defaulting to Base mainnet USDC, and the EIP-712 token domain (`USDC` on Base Sepolia vs `USD Coin` on Base mainnet) resolves from a single per-network table shared by `wallet.ts` and `buildTransferAuthorizationTypedData` (#3).
- Add settled amount cross-checking in `FacilitatorClient.settle()` (#4).
- `generateNonce()` uses Web Crypto, falls back to `node:crypto` only where `require` actually exists, and otherwise fails closed with an actionable message instead of a `ReferenceError` (#5).
- Protected-route matching normalizes duplicate slashes, percent-escapes and `.`/`..` segments, so `//api/report`, `/api/premium%2Dreport` and `/api/x/%2E%2E/report` can no longer be served unpaid; route keys that collide after normalization raise a configuration error (#6).
- `scaleToAssetUnits` rounds sub-unit precision half-up instead of truncating and rejects malformed numeric strings; a misconfigured route price returns a diagnosable 500 instead of an unhandled exception (#7).
