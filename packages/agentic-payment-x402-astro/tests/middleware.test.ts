import { describe, expect, it, vi } from 'vitest';
import { createX402Middleware } from '../src/middleware.js';
import type { PaymentPayload, PaymentRequirements } from 'agentic-payment-x402-core';

describe('Astro x402 Middleware', () => {
  const options = {
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    protectedRoutes: {
      '/api/premium-report': 5.0, // $5.00
    },
  };

  const middleware = createX402Middleware(options);

  it('passes through unprotected routes untouched', async () => {
    const next = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    const context = {
      request: new Request('http://localhost/api/free-content'),
      url: new URL('http://localhost/api/free-content'),
      locals: {},
    };

    const response = await middleware(context, next);
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('returns HTTP 402 with PaymentRequirements when no payment header is provided', async () => {
    const next = vi.fn();
    const context = {
      request: new Request('http://localhost/api/premium-report'),
      url: new URL('http://localhost/api/premium-report'),
      locals: {},
    };

    const response = await middleware(context, next);
    expect(response.status).toBe(402);
    expect(next).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.error).toBe('Payment Required');
    expect(body.x402Version).toBe(2);
    expect(body.paymentRequirements.amount).toBe('5000000'); // $5.00 scaled to 6 decimals
    expect(body.paymentRequirements.payTo).toBe(options.payTo);
  });

  it('settles and passes through when valid X-Payment header is supplied', async () => {
    const reqs: PaymentRequirements = {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '5000000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: options.payTo,
      maxTimeoutSeconds: 60,
    };

    const payload: PaymentPayload = {
      x402Version: 2,
      accepted: reqs,
      payload: {
        signature: '0x' + '11'.repeat(65),
        authorization: {
          from: '0x1111111111111111111111111111111111111111',
          to: options.payTo,
          value: '5000000',
          validAfter: 0,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + '00'.repeat(32),
        },
      },
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ isValid: true }),
        });
      }
      if (url.endsWith('/settle')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              transaction: '0xtx789',
              network: 'eip155:8453',
              amount: '5000000',
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const next = vi.fn().mockResolvedValue(new Response('Premium Content Delivered', { status: 200 }));
    const context = {
      request: new Request('http://localhost/api/premium-report', {
        headers: {
          'X-Payment': JSON.stringify(payload),
        },
      }),
      url: new URL('http://localhost/api/premium-report'),
      locals: {},
    };

    const response = await middleware(context, next);
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalled();
    expect(response.headers.get('X-Payment-Transaction')).toBe('0xtx789');
  });
});
