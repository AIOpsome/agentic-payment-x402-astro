import {
  FacilitatorClient,
  scaleToAssetUnits,
  validatePaymentPayload,
  type PaymentPayload,
  type PaymentRequirements,
  type SettlementResult,
} from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions, RoutePriceConfig } from './types.js';
import { DEFAULT_NETWORK, getDefaultAssetForNetwork } from './integration.js';
import { decodeBase64, encodeBase64 } from './base64.js';

export interface X402Locals {
  x402Payment?: SettlementResult;
}

/**
 * Normalizes a URL path for protected-route matching. Percent-escapes are decoded once, `.`/`..`
 * segments are resolved, duplicate slashes collapse, case is folded and trailing slashes are
 * stripped — so `//api/Report/`, `/api/premium%2Dreport` and `/api/x/%2E%2E/report` cannot slip
 * past a configured route.
 */
export function normalizeRoutePath(pathname: string): string {
  let decoded = pathname.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed percent-escape: match on the raw path rather than guessing at its decoding.
  }

  const segments: string[] = [];
  for (const segment of decoded.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const normalized = ('/' + segments.join('/')).toLowerCase().replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

/**
 * Creates Astro Middleware that intercepts protected routes and enforces x402 payment negotiation for AI agents.
 */
export function createX402Middleware(options: AgenticPayAstroOptions) {
  const facilitatorClient = new FacilitatorClient(options.facilitators);
  const defaultNetwork = options.network || DEFAULT_NETWORK;
  const defaultAsset = options.asset || getDefaultAssetForNetwork(defaultNetwork);
  const decimals = options.assetDecimals ?? 6;

  // Pre-normalize the protected route map, rejecting configurations where two distinct routes
  // normalize to the same key (e.g. '/a' and '/A') rather than silently pricing both as one.
  const protectedRoutes = new Map<string, RoutePriceConfig | number | string>();
  const routeSources = new Map<string, string>();
  for (const [route, config] of Object.entries(options.protectedRoutes || {})) {
    const key = normalizeRoutePath(route);
    const existing = routeSources.get(key);
    if (existing !== undefined && existing !== route) {
      throw new Error(
        `agentic-payment-x402-astro: protected routes "${existing}" and "${route}" both normalize to "${key}". ` +
          'Route matching is case-insensitive and slash/percent-normalized, so these cannot be priced separately. ' +
          'Merge them into a single entry.'
      );
    }
    routeSources.set(key, route);
    protectedRoutes.set(key, config);
  }

  return async (context: { request: Request; url: URL; locals: Record<string, unknown> }, next: () => Promise<Response>) => {
    const normalizedPath = normalizeRoutePath(context.url.pathname);

    const routeConfig = protectedRoutes.get(normalizedPath);
    if (routeConfig === undefined) {
      return next();
    }

    const price: RoutePriceConfig =
      typeof routeConfig === 'object'
        ? routeConfig
        : { amount: routeConfig };

    let atomicAmount: string;
    try {
      atomicAmount = scaleToAssetUnits(price.amount, decimals);
    } catch (err: unknown) {
      return new Response(
        JSON.stringify({
          error: 'x402 Route Misconfigured',
          message: `Protected route "${normalizedPath}" has an unusable price: ${(err as Error).message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payTo = price.payTo || options.payTo;
    const asset = price.asset || defaultAsset;

    const requirements: PaymentRequirements = {
      scheme: 'exact',
      network: defaultNetwork,
      amount: atomicAmount,
      asset,
      payTo,
      maxTimeoutSeconds: 60,
    };

    // HTTP header names are case-insensitive, so one get() per header name is sufficient.
    const paymentHeader =
      context.request.headers.get('payment-signature') || context.request.headers.get('x-payment');

    if (!paymentHeader) {
      const paymentRequiredObject = {
        x402Version: 2,
        resource: { url: context.url.toString() },
        accepts: [requirements],
      };

      // x402 v2: requirements travel base64-encoded in PAYMENT-REQUIRED and the body stays empty.
      return new Response(JSON.stringify({}), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-REQUIRED': encodeBase64(JSON.stringify(paymentRequiredObject)),
          'X-Payment-Requirements': JSON.stringify(requirements),
        },
      });
    }

    // Parse payload (supports both base64 encoded JSON and raw JSON)
    let payload: PaymentPayload;
    try {
      payload = JSON.parse(decodeBase64(paymentHeader));
    } catch {
      try {
        payload = JSON.parse(paymentHeader);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed payment header JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const validation = validatePaymentPayload(payload, requirements);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Settle with facilitator
    const settlement = await facilitatorClient.settle(payload, requirements);
    if (!settlement.success) {
      return new Response(
        JSON.stringify({
          error: 'Settlement Failed',
          message: settlement.message,
        }),
        {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Inject settlement into context.locals for downstream handler usage
    context.locals.x402Payment = settlement;

    const response = await next();
    if (settlement.txHash) {
      const settlementResponseObject = {
        success: true,
        transaction: settlement.txHash,
        network: defaultNetwork,
      };
      response.headers.set('PAYMENT-RESPONSE', encodeBase64(JSON.stringify(settlementResponseObject)));
      response.headers.set('X-Payment-Transaction', settlement.txHash);
    }
    return response;
  };
}
