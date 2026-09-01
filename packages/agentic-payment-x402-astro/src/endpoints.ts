import {
  FacilitatorClient,
  scaleToAssetUnits,
  validatePaymentPayload,
  type PaymentRequirements,
} from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions } from './types.js';
import { DEFAULT_NETWORK, getDefaultAssetForNetwork } from './integration.js';

/**
 * Creates an Astro API Route handler (POST) for settling human or agent checkout payloads.
 * Protects against client-controlled amount tampering by enforcing server-side price resolution.
 */
export function createX402SettlementHandler(options: AgenticPayAstroOptions) {
  const facilitatorClient = new FacilitatorClient(options.facilitators);
  const network = options.network || DEFAULT_NETWORK;
  const asset = options.asset || getDefaultAssetForNetwork(network);
  const decimals = options.assetDecimals ?? 6;

  return async ({ request }: { request: Request }) => {
    try {
      const body = await request.json();
      const { paymentPayload } = body;

      if (!paymentPayload) {
        return new Response(JSON.stringify({ error: 'Missing paymentPayload in request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Resolve server-side expected price
      let expectedAmount: number | string;
      if (options.resolveOrderAmount) {
        expectedAmount = await options.resolveOrderAmount(body);
      } else if (body.orderId && options.protectedRoutes && options.protectedRoutes[body.orderId]) {
        const routeCfg = options.protectedRoutes[body.orderId];
        expectedAmount = typeof routeCfg === 'object' ? routeCfg.amount : routeCfg;
      } else if (body.amount !== undefined) {
        // Fallback for standalone buttons with client amount, validating positive numeric value
        expectedAmount = body.amount;
      } else if (paymentPayload.accepted?.amount) {
        expectedAmount = paymentPayload.accepted.amount;
      } else {
        return new Response(JSON.stringify({ error: 'Cannot determine server-side required amount' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const atomicAmount = scaleToAssetUnits(expectedAmount, decimals);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network,
        amount: atomicAmount,
        asset,
        payTo: options.payTo,
      };

      const validation = validatePaymentPayload(paymentPayload, requirements);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await facilitatorClient.settle(paymentPayload, requirements);

      if (!result.success) {
        return new Response(JSON.stringify({ error: result.message || 'Settlement failed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
