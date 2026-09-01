import { describe, expect, it } from 'vitest';
import { isValidEthereumAddress, normalizeAddress } from '../src/crypto/address.js';
import { generateNonce } from '../src/crypto/nonce.js';
import { buildTransferAuthorizationTypedData } from '../src/crypto/eip712.js';

describe('Crypto & Address Primitives', () => {
  it('validates Ethereum addresses', () => {
    expect(isValidEthereumAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')).toBe(true);
    expect(isValidEthereumAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')).toBe(true);
    expect(isValidEthereumAddress('0x123')).toBe(false);
    expect(isValidEthereumAddress('invalid')).toBe(false);
  });

  it('normalizes addresses', () => {
    expect(normalizeAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')).toBe(
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    );
  });

  it('generates 32-byte nonces', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^0x[a-f0-9]{64}$/i);
  });

  it('builds EIP-712 typed data structure', () => {
    const typed = buildTransferAuthorizationTypedData(
      {
        name: 'USD Coin',
        version: '2',
        chainId: 8453,
        verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000',
        validAfter: 0,
        validBefore: 1800000000,
        nonce: '0x' + '00'.repeat(32),
      }
    );

    expect(typed.primaryType).toBe('TransferWithAuthorization');
    expect(typed.domain.chainId).toBe(8453);
    expect(typed.message.value).toBe('1000000');
  });
});
