import { describe, expect, it, vi } from 'vitest';
import { FacilitatorClient } from '../src/server/facilitator.js';
import type { PaymentPayload, PaymentRequirements } from '../src/types.js';

describe('Facilitator Client', () => {
  const reqs: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  };

  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: reqs,
    payload: {
      signature: '0x' + '11'.repeat(65),
      authorization: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        value: '1000000',
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: '0x' + '00'.repeat(32),
      },
    },
  };

  it('settles successfully when facilitator returns valid response', async () => {
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
              transaction: '0xtxhash123',
              network: 'eip155:8453',
              amount: '1000000',
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const client = new FacilitatorClient(['https://facilitator.payai.network']);
    const result = await client.settle(payload, reqs);

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xtxhash123');
    expect(result.settledAmount).toBe('1000000');
  });

  it('rejects settlement when facilitator returns mismatched amount', async () => {
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
              transaction: '0xtxhash123',
              network: 'eip155:8453',
              amount: '500000', // Mismatched lower amount
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const client = new FacilitatorClient(['https://facilitator.payai.network']);
    const result = await client.settle(payload, reqs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('does not match required amount');
  });
});
