import {
  FacilitatorClient,
  scaleToAssetUnits,
  validatePaymentPayload,
  type PaymentRequirements,
} from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions } from './types.js';
import { DEFAULT_NETWORK, getDefaultAssetForNetwork } from './integration.js';

const RESOLVER_REQUIRED_MESSAGE =
  'agentic-payment-x402-astro: `resolveOrderAmount` is required by createX402SettlementHandler. ' +
  'The settlement endpoint never trusts a client-supplied amount, so the price must come from your own ' +
  'server-side order lookup, e.g. resolveOrderAmount: async ({ orderId }) => (await getOrder(orderId)).totalUsd';

/**
 * Creates an Astro API Route handler (POST) for settling human or agent checkout payloads.
 *
 * The settled amount always comes from `options.resolveOrderAmount`, never from the request body:
 * every amount a client can send (`amount`, `orderId`, `paymentPayload.accepted`) is attacker-controlled.
 */
export function createX402SettlementHandler(options: AgenticPayAstroOptions) {
  const resolveOrderAmount = options.resolveOrderAmount;
  if (typeof resolveOrderAmount !== 'function') {
    throw new Error(RESOLVER_REQUIRED_MESSAGE);
  }

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

      const expectedAmount = await resolveOrderAmount(body);
      if (expectedAmount === undefined || expectedAmount === null || expectedAmount === '') {
        return new Response(
          JSON.stringify({ error: 'Order not found or has no server-side price; settlement refused' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let atomicAmount: string;
      try {
        atomicAmount = scaleToAssetUnits(expectedAmount, decimals);
      } catch (err: unknown) {
        return new Response(
          JSON.stringify({
            error: `Server-side price resolution produced an unusable amount: ${(err as Error).message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

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
