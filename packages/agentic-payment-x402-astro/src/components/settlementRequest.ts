/**
 * Shared POST body construction for the checkout components and the settlement endpoint contract.
 *
 * `orderId` is the only field the server prices from: `resolveOrderAmount` receives this body and
 * looks the real price up in merchant-side state. `amount` travels for display/telemetry only and
 * the endpoint never reads it as a price.
 */
export interface SettlementRequestInput {
  orderId: string;
  paymentPayload: unknown;
  amount: number | string;
  network: string;
  asset: string;
}

export interface SettlementRequestBody {
  orderId: string;
  paymentPayload: unknown;
  amount: string;
  network: string;
  asset: string;
}

export function buildSettlementRequestBody(input: SettlementRequestInput): SettlementRequestBody {
  const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : '';
  if (orderId === '') {
    throw new Error(
      'Agentic Pay: no orderId available for this checkout. Pass a non-empty `orderId` prop identifying ' +
        'the order or cart; the settlement endpoint prices from it and refuses settlement without it.'
    );
  }

  return {
    orderId,
    paymentPayload: input.paymentPayload,
    amount: String(input.amount),
    network: input.network,
    asset: input.asset,
  };
}
