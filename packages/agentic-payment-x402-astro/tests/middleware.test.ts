import { describe, expect, it, vi } from 'vitest';
import { createX402Middleware, normalizeRoutePath } from '../src/middleware.js';
import { decodeBase64, encodeBase64 } from '../src/base64.js';
import type { PaymentPayload, PaymentRequirements } from 'agentic-payment-x402-core';

describe('Astro x402 Middleware', () => {
  const options = {
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    protectedRoutes: {
      '/api/premium-report': 5.0, // $5.00
    },
  };

  const middleware = createX402Middleware(options);

  function contextFor(path: string) {
    const url = new URL('http://localhost' + path);
    return { request: new Request(url.toString()), url, locals: {} };
  }

  it('passes through unprotected routes untouched', async () => {
    const next = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

    const response = await middleware(contextFor('/api/free-content'), next);
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('intercepts trailing-slash variant of protected route safely (Issue #6)', async () => {
    const next = vi.fn();

    const response = await middleware(contextFor('/api/premium-report/'), next);
    expect(response.status).toBe(402);
    expect(next).not.toHaveBeenCalled();

    expect(response.headers.get('PAYMENT-REQUIRED')).not.toBeNull();
  });

  it('intercepts duplicate-slash, percent-encoded, case and dot-segment variants (Issue #6)', async () => {
    const bypasses = [
      '//api/premium-report',
      '///api//premium-report',
      '/api/premium%2Dreport',
      '/API/Premium-Report',
      '/api/./premium-report',
      '/api/other/%2E%2E/premium-report',
      '/api%2Fpremium-report',
      '/api/premium-report//',
    ];

    for (const path of bypasses) {
      const next = vi.fn().mockResolvedValue(new Response('PAID CONTENT', { status: 200 }));
      const response = await middleware(contextFor(path), next);
      expect(response.status, `${path} should require payment`).toBe(402);
      expect(next, `${path} should not be served unpaid`).not.toHaveBeenCalled();
    }
  });

  it('normalizes route paths without breaking distinct routes', () => {
    expect(normalizeRoutePath('//api//premium-report/')).toBe('/api/premium-report');
    expect(normalizeRoutePath('/api/premium%2Dreport')).toBe('/api/premium-report');
    expect(normalizeRoutePath('/')).toBe('/');
    expect(normalizeRoutePath('/api/a')).not.toBe(normalizeRoutePath('/api/b'));
    // A malformed escape must not throw; it simply matches on the raw path.
    expect(normalizeRoutePath('/api/%zz')).toBe('/api/%zz');
  });

  it('rejects a protected route map whose keys collide after normalization', () => {
    expect(() =>
      createX402Middleware({ payTo: options.payTo, protectedRoutes: { '/api/a': 1, '/API/A/': 2 } })
    ).toThrow(/both normalize to/);
  });

  it('returns a diagnosable 500 for a route configured with an unusable price', async () => {
    const brokenMiddleware = createX402Middleware({
      payTo: options.payTo,
      protectedRoutes: { '/api/broken': 0 },
    });

    const next = vi.fn();
    const response = await brokenMiddleware(contextFor('/api/broken'), next);
    expect(response.status).toBe(500);
    expect(next).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.message).toContain('unusable price');
  });

  it('returns HTTP 402 with a single, spec-decodable PAYMENT-REQUIRED header (Issue #2)', async () => {
    const next = vi.fn();

    const response = await middleware(contextFor('/api/premium-report'), next);
    expect(response.status).toBe(402);
    expect(next).not.toHaveBeenCalled();

    const requiredHeader = response.headers.get('PAYMENT-REQUIRED');
    expect(requiredHeader).not.toBeNull();
    // A duplicated header would be comma-joined and break spec-compliant atob() decoders.
    expect(requiredHeader).not.toContain(',');
    expect(() => atob(requiredHeader!)).not.toThrow();

    const decoded = JSON.parse(decodeBase64(requiredHeader!));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].amount).toBe('5000000');

    // x402 v2 requires an empty JSON body on the 402 response.
    expect(await response.json()).toEqual({});
  });

  it('settles with PAYMENT-SIGNATURE header and responds with PAYMENT-RESPONSE (Issue #2)', async () => {
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

    const base64Payload = encodeBase64(JSON.stringify(payload));
    const next = vi.fn().mockResolvedValue(new Response('Premium Content Delivered', { status: 200 }));
    const context = {
      request: new Request('http://localhost/api/premium-report', {
        headers: {
          'PAYMENT-SIGNATURE': base64Payload,
        },
      }),
      url: new URL('http://localhost/api/premium-report'),
      locals: {},
    };

    const response = await middleware(context, next);
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalled();

    const responseHeader = response.headers.get('PAYMENT-RESPONSE');
    expect(responseHeader).not.toBeNull();
    expect(responseHeader).not.toContain(',');
    const decodedRes = JSON.parse(decodeBase64(responseHeader!));
    expect(decodedRes.transaction).toBe('0xtx789');
  });

  it('encodes and decodes payment headers without Node Buffer (edge runtime support)', () => {
    const value = JSON.stringify({ note: 'unicode ✓ payload' });
    expect(decodeBase64(encodeBase64(value))).toBe(value);
  });
});
