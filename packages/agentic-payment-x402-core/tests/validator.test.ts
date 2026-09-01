import { describe, expect, it } from 'vitest';
import { validatePaymentPayload } from '../src/server/validator.js';
import type { PaymentPayload, PaymentRequirements } from '../src/types.js';

describe('Payment Payload Validator', () => {
  const reqs: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    maxTimeoutSeconds: 60,
  };

  const validPayload: PaymentPayload = {
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

  it('accepts well-formed matching payload', () => {
    const res = validatePaymentPayload(validPayload, reqs);
    expect(res.valid).toBe(true);
  });

  it('rejects version mismatch', () => {
    const res = validatePaymentPayload({ ...validPayload, x402Version: 1 }, reqs);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unsupported x402 version');
  });

  it('rejects amount mismatch', () => {
    const res = validatePaymentPayload(
      {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: { ...validPayload.payload.authorization, value: '500000' },
        },
      },
      reqs
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain('does not match required amount');
  });

  it('rejects expired validBefore', () => {
    const res = validatePaymentPayload(
      {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: { ...validPayload.payload.authorization, validBefore: 1000 },
        },
      },
      reqs
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain('expired');
  });
});
