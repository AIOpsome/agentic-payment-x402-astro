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

export interface X402Locals {
  x402Payment?: SettlementResult;
}

/**
 * Normalizes URL path for safe protected route matching (case-folding & trailing slash stripping).
 */
export function normalizeRoutePath(pathname: string): string {
  const normalized = pathname.trim().toLowerCase().replace(/\/+$/, '');
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

  // Pre-normalize protected route map
  const protectedRouteEntries = Object.entries(options.protectedRoutes || {}).map(([route, config]) => [
    normalizeRoutePath(route),
    config,
  ]) as Array<[string, RoutePriceConfig | number | string]>;

  return async (context: { request: Request; url: URL; locals: Record<string, unknown> }, next: () => Promise<Response>) => {
    const rawPath = context.url.pathname;
    const normalizedPath = normalizeRoutePath(rawPath);

    const match = protectedRouteEntries.find(([route]) => route === normalizedPath);
    if (!match) {
      return next();
    }

    const routeConfig = match[1];
    const price: RoutePriceConfig =
      typeof routeConfig === 'object'
        ? routeConfig
        : { amount: routeConfig };

    const atomicAmount = scaleToAssetUnits(price.amount, decimals);
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

    // Check for x402 v2 standard headers or legacy v1 headers
    const paymentHeader =
      context.request.headers.get('payment-signature') ||
      context.request.headers.get('Payment-Signature') ||
      context.request.headers.get('PAYMENT-SIGNATURE') ||
      context.request.headers.get('x-payment') ||
      context.request.headers.get('X-Payment') ||
      context.request.headers.get('X-PAYMENT');

    if (!paymentHeader) {
      const paymentRequiredObject = {
        x402Version: 2,
        resource: { url: context.url.toString() },
        accepts: [requirements],
      };
      const base64Required = Buffer.from(JSON.stringify(paymentRequiredObject)).toString('base64');

      return new Response(
        JSON.stringify({
          error: 'Payment Required',
          message: 'Accessing this resource requires an x402 payment authorization.',
          x402Version: 2,
          paymentRequirements: requirements,
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'PAYMENT-REQUIRED': base64Required,
            'Payment-Required': base64Required,
            'X-Payment-Requirements': JSON.stringify(requirements),
          },
        }
      );
    }

    // Parse payload (supports both base64 encoded JSON and raw JSON)
    let payload: PaymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf8');
      payload = JSON.parse(decoded);
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
      const base64Settlement = Buffer.from(JSON.stringify(settlementResponseObject)).toString('base64');
      response.headers.set('PAYMENT-RESPONSE', base64Settlement);
      response.headers.set('Payment-Response', base64Settlement);
      response.headers.set('X-Payment-Transaction', settlement.txHash);
    }
    return response;
  };
}
