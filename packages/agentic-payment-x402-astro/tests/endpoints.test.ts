import { describe, expect, it, vi } from 'vitest';
import { createX402SettlementHandler } from '../src/endpoints.js';
import type { PaymentPayload, PaymentRequirements } from 'agentic-payment-x402-core';

describe('Astro Settlement Endpoint Handler', () => {
  const handler = createX402SettlementHandler({
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    resolveOrderAmount: async (body) => {
      if (body.orderId === 'ORDER_PREMIUM') return 2500; // $2500
      return 10;
    },
  });

  it('enforces server-side amount and rejects lower client tampered amount (Issue #1)', async () => {
    const reqs: PaymentRequirements = {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '10000', // 0.01 USDC (tampered)
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    };

    const tamperedPayload: PaymentPayload = {
      x402Version: 2,
      accepted: reqs,
      payload: {
        signature: '0x' + '11'.repeat(65),
        authorization: {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          value: '10000',
          validAfter: 0,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + '00'.repeat(32),
        },
      },
    };

    const request = new Request('http://localhost/api/x402/settle', {
      method: 'POST',
      body: JSON.stringify({
        paymentPayload: tamperedPayload,
        orderId: 'ORDER_PREMIUM',
        amount: '0.01', // Attacker trying to pay $0.01 for a $2500 order
      }),
    });

    const response = await handler({ request });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Amount mismatch');
  });
});
