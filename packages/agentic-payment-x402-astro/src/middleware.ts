import {
  FacilitatorClient,
  scaleToAssetUnits,
  validatePaymentPayload,
  type PaymentPayload,
  type PaymentRequirements,
  type SettlementResult,
} from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions, RoutePriceConfig } from './types.js';
import { DEFAULT_BASE_USDC, DEFAULT_NETWORK } from './integration.js';

export interface X402Locals {
  x402Payment?: SettlementResult;
}

/**
 * Creates Astro Middleware that intercepts protected routes and enforces x402 payment negotiation for AI agents.
 */
export function createX402Middleware(options: AgenticPayAstroOptions) {
  const facilitatorClient = new FacilitatorClient(options.facilitators);
  const defaultNetwork = options.network || DEFAULT_NETWORK;
  const defaultAsset = options.asset || DEFAULT_BASE_USDC;
  const decimals = options.assetDecimals ?? 6;

  return async (context: { request: Request; url: URL; locals: Record<string, unknown> }, next: () => Promise<Response>) => {
    const pathname = context.url.pathname;
    const protectedRoutes = options.protectedRoutes || {};

    // Check if route is protected
    const routeConfig = protectedRoutes[pathname];
    if (!routeConfig) {
      return next();
    }

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

    // Check for payment header
    const paymentHeader =
      context.request.headers.get('x-payment') ||
      context.request.headers.get('X-Payment') ||
      context.request.headers.get('X-PAYMENT');

    if (!paymentHeader) {
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
            'X-Payment-Requirements': JSON.stringify(requirements),
          },
        }
      );
    }

    // Parse and validate payment header
    let payload: PaymentPayload;
    try {
      payload = JSON.parse(paymentHeader);
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed X-Payment header JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      response.headers.set('X-Payment-Transaction', settlement.txHash);
    }
    return response;
  };
}
