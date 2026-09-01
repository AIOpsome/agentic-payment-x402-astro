/**
 * End-to-end guard for the documented integration path (issue #1, round 3).
 *
 * Rounds 1 and 2 fixed the library while leaving the shipped component unable to satisfy it: the
 * button POSTed no order identifier, so the README's `resolveOrderAmount({ orderId })` refused every
 * checkout and the only way to make it work was `({ amount }) => amount` — the original bypass, moved
 * into the integrator's code. This test drives the *actual* client script out of
 * AgenticPayButton.astro, feeds its real POST body into the real settlement handler configured exactly
 * as the README documents, and asserts both that a genuine checkout succeeds and that tampering with
 * any client-controlled field cannot change the settled amount.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createX402SettlementHandler } from '../src/endpoints.js';
import { buildSettlementRequestBody } from '../src/components/settlementRequest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUTTON_ASTRO = resolve(HERE, '../src/components/AgenticPayButton.astro');

const PAY_TO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const NETWORK = 'eip155:8453';
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// The merchant-side order store the README's `getOrder` stands in for.
const ORDERS: Record<string, { totalUsd: number; status: string }> = {
  ORDER_RETAINER: { totalUsd: 2500, status: 'awaiting_payment' },
};

/** Exactly the resolver shape the README quick start documents. */
async function readmeResolveOrderAmount({ orderId }: Record<string, unknown>) {
  if (typeof orderId !== 'string' || orderId === '') return null;
  const order = ORDERS[orderId];
  if (!order || order.status !== 'awaiting_payment') return null;
  return order.totalUsd;
}

function buildHandler() {
  return createX402SettlementHandler({
    payTo: PAY_TO,
    network: NETWORK,
    facilitators: ['https://facilitator.example'],
    resolveOrderAmount: readmeResolveOrderAmount,
  });
}

/**
 * Loads the inline `<script>` out of the shipped .astro component and runs it against a minimal DOM,
 * so the POST body under test is the one the component really constructs rather than a restatement.
 */
async function runShippedButtonScript(dataset: Record<string, string>) {
  const source = readFileSync(BUTTON_ASTRO, 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('AgenticPayButton.astro no longer contains an inline <script>');

  const body = script[1]
    .replace(/^\s*import .*?from '[^']*';\s*$/gm, '')
    .replace(/<HTMLButtonElement>|<HTMLElement>/g, '')
    .replace(/\bas const\b/g, '')
    .replace(/: unknown\b/g, '')
    .replace(/\(err as Error\)/g, 'err');

  const listeners: Array<() => Promise<void>> = [];
  const span = { style: {}, textContent: '' };
  const btn = {
    dataset,
    disabled: false,
    style: {} as Record<string, string>,
    querySelector: () => span,
    addEventListener: (_: string, fn: () => Promise<void>) => listeners.push(fn),
    dispatchEvent: () => true,
  };

  const captured: { url?: string; body?: Record<string, unknown> } = {};
  const errors: string[] = [];

  const fn = new Function(
    'document',
    'fetch',
    'alert',
    'CustomEvent',
    'setTimeout',
    'window',
    'signPaymentAuthorization',
    'scaleToAssetUnits',
    'buildSettlementRequestBody',
    `${body}\n`
  );

  fn(
    { querySelectorAll: () => [btn] },
    async (url: string, init: { body: string }) => {
      captured.url = url;
      captured.body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ success: true }) };
    },
    (message: string) => errors.push(message),
    class {
      constructor(
        public type: string,
        public init?: unknown
      ) {}
    },
    () => undefined,
    { location: {} },
    // Stubbed wallet: signs whatever requirements the component computed.
    async ({ requirements }: { requirements: Record<string, unknown> }) => ({
      x402Version: 2,
      accepted: requirements,
      payload: {
        signature: '0x' + '11'.repeat(65),
        authorization: {
          from: '0x1111111111111111111111111111111111111111',
          to: requirements.payTo,
          value: requirements.amount,
          validAfter: 0,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + '00'.repeat(32),
        },
      },
    }),
    (amount: string | number, decimals: number) => {
      const [whole, frac = ''] = String(amount).split('.');
      return (whole + frac.padEnd(decimals, '0').slice(0, decimals)).replace(/^0+(?=\d)/, '');
    },
    buildSettlementRequestBody
  );

  for (const listener of listeners) await listener();
  return { request: captured, errors };
}

async function post(handler: ReturnType<typeof buildHandler>, requestBody: unknown) {
  const response = await handler({
    request: new Request('http://localhost/api/x402/settle', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }),
  });
  return { status: response.status, body: await response.json() };
}

function mockFacilitator(settledAmount: string) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/verify')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ isValid: true }) });
    }
    if (url.endsWith('/settle')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            transaction: '0xdeadbeef',
            network: NETWORK,
            amount: settledAmount,
          }),
      });
    }
    return Promise.reject(new Error(`Unexpected URL ${url}`));
  });
}

describe('documented integration path: shipped component -> shipped endpoint', () => {
  const buttonProps = {
    orderid: 'ORDER_RETAINER',
    amount: '2500',
    currency: 'USD',
    payto: PAY_TO,
    network: NETWORK,
    asset: ASSET,
    endpoint: '/api/x402/settle',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the order identifier, network and asset the endpoint needs', async () => {
    const { request, errors } = await runShippedButtonScript({ ...buttonProps });

    expect(errors).toEqual([]);
    expect(request.url).toBe('/api/x402/settle');
    expect(request.body).toMatchObject({
      orderId: 'ORDER_RETAINER',
      network: NETWORK,
      asset: ASSET,
    });
    expect(request.body?.paymentPayload).toBeTruthy();
  });

  it('settles a real checkout at the server-resolved price', async () => {
    const { request } = await runShippedButtonScript({ ...buttonProps });
    mockFacilitator('2500000000');

    const response = await post(buildHandler(), request.body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('rejects a tampered amount in the very body the component produces', async () => {
    const { request } = await runShippedButtonScript({ ...buttonProps, amount: '0.01' });
    mockFacilitator('10000');

    // The shopper signed for $0.01 while the order really costs $2,500.
    const response = await post(buildHandler(), request.body);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Amount mismatch');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a hand-edited amount field with an otherwise valid $2,500 payload', async () => {
    const { request } = await runShippedButtonScript({ ...buttonProps });
    mockFacilitator('2500000000');

    const response = await post(buildHandler(), { ...request.body, amount: '0.01' });

    // `amount` is display-only: a lie there changes nothing.
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('refuses an unknown or already-paid orderId', async () => {
    const { request } = await runShippedButtonScript({ ...buttonProps });

    for (const orderId of ['NOPE', '', '/api/cheap']) {
      const response = await post(buildHandler(), { ...request.body, orderId });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('no server-side price');
    }
  });

  it('rejects a client that signed for a different network or asset', async () => {
    const { request } = await runShippedButtonScript({
      ...buttonProps,
      network: 'eip155:84532',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    });

    expect(request.body?.network).toBe('eip155:84532');

    const response = await post(buildHandler(), request.body);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('eip155:84532');
  });
});

describe('buildSettlementRequestBody', () => {
  it('carries orderId, network and asset and stringifies the display amount', () => {
    expect(
      buildSettlementRequestBody({
        orderId: ' ORDER_1 ',
        paymentPayload: { x402Version: 2 },
        amount: 2500,
        network: NETWORK,
        asset: ASSET,
      })
    ).toEqual({
      orderId: 'ORDER_1',
      paymentPayload: { x402Version: 2 },
      amount: '2500',
      network: NETWORK,
      asset: ASSET,
    });
  });

  it('fails closed rather than POSTing a checkout with no order identifier', () => {
    for (const orderId of ['', '   ', undefined as unknown as string]) {
      expect(() =>
        buildSettlementRequestBody({
          orderId,
          paymentPayload: {},
          amount: 1,
          network: NETWORK,
          asset: ASSET,
        })
      ).toThrow(/orderId/);
    }
  });
});
