# agentic-payment-x402-core

## 0.2.0

### Minor Changes

- 528f165: Fix security, validation, and protocol compliance issues (fixes #1, #2, #3, #4, #5, #6, #7):
  - `createX402SettlementHandler` now **requires** `resolveOrderAmount` and never reads a price from the request body (`amount`, `orderId`, or the signed `accepted` requirements), closing the pay-any-price bypass that was reachable in the previously documented default configuration (#1).
  - Spec-compliant x402 v2 wire transport: `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` are each set exactly once (a duplicated header was comma-joined and broke strict `atob()` clients), the 402 body is `{}`, and base64 encoding uses Web-standard APIs so the middleware still runs on Cloudflare/Deno/Vercel edge adapters (#2).
  - Unknown networks raise a configuration error instead of silently defaulting to Base mainnet USDC, and the EIP-712 token domain (`USDC` on Base Sepolia vs `USD Coin` on Base mainnet) resolves from a single per-network table shared by `wallet.ts` and `buildTransferAuthorizationTypedData` (#3).
  - Add settled amount cross-checking in `FacilitatorClient.settle()` (#4).
  - `generateNonce()` uses Web Crypto, falls back to `node:crypto` only where `require` actually exists, and otherwise fails closed with an actionable message instead of a `ReferenceError` (#5).
  - Protected-route matching normalizes duplicate slashes, percent-escapes and `.`/`..` segments, so `//api/report`, `/api/premium%2Dreport` and `/api/x/%2E%2E/report` can no longer be served unpaid; route keys that collide after normalization raise a configuration error (#6).
  - `scaleToAssetUnits` rounds sub-unit precision half-up instead of truncating and rejects malformed numeric strings; a misconfigured route price returns a diagnosable 500 instead of an unhandled exception (#7). Small JS numbers no longer disagree with their string form (`0.0000005` vs `'0.0000005'`).
  - `AgenticPayButton` and `WalletCheckout` now take a required `orderId` prop and forward it — plus `network` and `asset` — in the settlement POST body, so the required `resolveOrderAmount` has a real key to price from. Without this, the only way to make the shipped component work against the shipped docs was `resolveOrderAmount: ({ amount }) => amount`, which reintroduced the #1 bypass in the integrator's own code.
  - `WalletCheckout` defaults `network` to the CAIP-2 id `eip155:8453` instead of the display string `Base (Mainnet)`, derives its display labels from that, and forwards `network`/`asset` to the button — a merchant configured for Sepolia no longer signs mainnet requirements.
  - The settlement endpoint compares the client-declared `network`/`asset` against server config and rejects a mismatch with an actionable 400 (never adopting the client's values).
  - A post-broadcast settlement mismatch now carries `requiresReconciliation`, `txHash` and `payer` in the result, response body and an error-level log, so an operator can find an on-chain transfer that produced no fulfilled order.
  - `scaleToAssetUnits` is re-exported from `agentic-payment-x402-core/client`; the checkout components imported it from there, so the Astro client bundle previously failed to build.

### Patch Changes

- 4c79907: Initial release of Agentic Pay for Astro and universal TypeScript core engine.
