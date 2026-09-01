import { describe, expect, it, vi } from 'vitest';
import { createX402SettlementHandler } from '../src/endpoints.js';
import type { PaymentPayload, PaymentRequirements } from 'agentic-payment-x402-core';

const PAY_TO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

function buildPayload(atomicAmount: string): PaymentPayload {
  const reqs: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: atomicAmount,
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: PAY_TO,
  };

  return {
    x402Version: 2,
    accepted: reqs,
    payload: {
      signature: '0x' + '11'.repeat(65),
      authorization: {
        from: '0x1111111111111111111111111111111111111111',
        to: PAY_TO,
        value: atomicAmount,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: '0x' + '00'.repeat(32),
      },
    },
  };
}

function mockFacilitatorSuccess() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/verify')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ isValid: true }) });
    }
    if (url.endsWith('/settle')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, transaction: '0xdeadbeef', network: 'eip155:8453' }),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

async function post(
  handler: (args: { request: Request }) => Promise<Response>,
  requestBody: Record<string, unknown>
): Promise<{ status: number; body: Record<string, string> }> {
  const request = new Request('http://localhost/api/x402/settle', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  const response = await handler({ request });
  return { status: response.status, body: await response.json() };
}

describe('Astro Settlement Endpoint Handler', () => {
  const handler = createX402SettlementHandler({
    payTo: PAY_TO,
    resolveOrderAmount: async (body) => {
      if (body.orderId === 'ORDER_PREMIUM') return 2500; // $2500
      return 10;
    },
  });

  it('enforces server-side amount and rejects lower client tampered amount (Issue #1)', async () => {
    const response = await post(handler, {
      paymentPayload: buildPayload('10000'), // 0.01 USDC (tampered)
      orderId: 'ORDER_PREMIUM',
      amount: '0.01', // Attacker trying to pay $0.01 for a $2500 order
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Amount mismatch');
  });

  it('refuses to build a handler without a server-side price resolver (Issue #1)', () => {
    expect(() =>
      createX402SettlementHandler({ payTo: PAY_TO, facilitators: ['https://facilitator.example'] })
    ).toThrow(/`resolveOrderAmount` is required/);
  });

  it('never falls back to a client-supplied amount or to accepted requirements (Issue #1)', async () => {
    mockFacilitatorSuccess();

    // Resolver ignores the request body entirely: the real order costs $2500.
    const strictHandler = createX402SettlementHandler({
      payTo: PAY_TO,
      facilitators: ['https://facilitator.example'],
      resolveOrderAmount: () => 2500,
    });

    for (const tampered of [
      { amount: '0.01' },
      { amount: 0.01 },
      { orderId: '/api/cheap' },
      { amount: '0.01', orderId: '/api/cheap' },
      {},
    ]) {
      const response = await post(strictHandler, { paymentPayload: buildPayload('10000'), ...tampered });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Amount mismatch');
    }

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cannot price-shop by passing a protected route path as orderId (Issue #1)', async () => {
    mockFacilitatorSuccess();

    const shoppableHandler = createX402SettlementHandler({
      payTo: PAY_TO,
      facilitators: ['https://facilitator.example'],
      protectedRoutes: { '/api/cheap': 0.01, '/api/expensive': 2500 },
      resolveOrderAmount: () => 2500,
    });

    const response = await post(shoppableHandler, {
      paymentPayload: buildPayload('10000'),
      orderId: '/api/cheap',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Amount mismatch');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('settles at the server-resolved price when the payload matches', async () => {
    mockFacilitatorSuccess();

    const strictHandler = createX402SettlementHandler({
      payTo: PAY_TO,
      facilitators: ['https://facilitator.example'],
      resolveOrderAmount: () => 2500,
    });

    const response = await post(strictHandler, {
      paymentPayload: buildPayload('2500000000'),
      amount: '0.01',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('refuses settlement when the resolver finds no price for the order (Issue #1)', async () => {
    const nullHandler = createX402SettlementHandler({
      payTo: PAY_TO,
      resolveOrderAmount: () => null,
    });

    const response = await post(nullHandler, { paymentPayload: buildPayload('10000'), amount: '0.01' });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('no server-side price');
  });

  it('reports an unusable server-side price as a diagnosable 500', async () => {
    const brokenHandler = createX402SettlementHandler({
      payTo: PAY_TO,
      resolveOrderAmount: () => 'free',
    });

    const response = await post(brokenHandler, { paymentPayload: buildPayload('10000') });
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Server-side price resolution produced an unusable amount');
  });
});
