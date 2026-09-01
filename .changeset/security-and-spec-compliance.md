---
"agentic-payment-x402-core": patch
"agentic-payment-x402-astro": patch
---

Fix security, validation, and protocol compliance issues (fixes #1, #2, #3, #4, #5, #6, #7):
- Implement server-side order price resolution in `createX402SettlementHandler` to prevent client amount tampering (#1).
- Implement spec-compliant x402 v2 standard wire transport headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`) with base64-encoded JSON (#2).
- Fix Base Sepolia default token asset and EIP-712 domain name resolution (`USDC` vs `USD Coin`) (#3).
- Add settled amount cross-checking in `FacilitatorClient.settle()` (#4).
- Use CSPRNG (`crypto.randomBytes(32)`) in `generateNonce()` instead of `Math.random()` (#5).
- Add path normalization in Astro middleware for trailing slash routing (#6).
- Add strict validation for non-positive amounts, `validAfter`, and scheme equality (#7).
