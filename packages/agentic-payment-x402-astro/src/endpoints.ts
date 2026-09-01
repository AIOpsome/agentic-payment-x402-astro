import {
  FacilitatorClient,
  scaleToAssetUnits,
  validatePaymentPayload,
  type PaymentRequirements,
} from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions } from './types.js';
import { DEFAULT_BASE_USDC, DEFAULT_NETWORK } from './integration.js';

/**
 * Creates an Astro API Route handler (POST) for settling human or agent checkout payloads.
 */
export function createX402SettlementHandler(options: AgenticPayAstroOptions) {
  const facilitatorClient = new FacilitatorClient(options.facilitators);
  const network = options.network || DEFAULT_NETWORK;
  const asset = options.asset || DEFAULT_BASE_USDC;
  const decimals = options.assetDecimals ?? 6;

  return async ({ request }: { request: Request }) => {
    try {
      const body = await request.json();
      const { paymentPayload, amount, payTo: customPayTo, asset: customAsset } = body;

      if (!paymentPayload) {
        return new Response(JSON.stringify({ error: 'Missing paymentPayload in request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payTo = customPayTo || options.payTo;
      const targetAsset = customAsset || asset;
      const atomicAmount = scaleToAssetUnits(amount || paymentPayload.accepted?.amount, decimals);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network,
        amount: atomicAmount,
        asset: targetAsset,
        payTo,
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
