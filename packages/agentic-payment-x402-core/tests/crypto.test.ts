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

  it('generates a nonce or fails closed with a clear message when no CSPRNG exists (Issue #5)', () => {
    const originalCrypto = globalThis.crypto;
    // Simulate a runtime with no Web Crypto: the fallback must not throw ReferenceError.
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      let nonce: string | undefined;
      let error: Error | undefined;
      try {
        nonce = generateNonce();
      } catch (err) {
        error = err as Error;
      }

      if (nonce) {
        expect(nonce).toMatch(/^0x[a-f0-9]{64}$/i);
      } else {
        expect(error).toBeInstanceOf(Error);
        expect(error!.name).not.toBe('ReferenceError');
        expect(error!.message).toContain('cryptographically secure');
      }
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    }
  });

  it('resolves the EIP-712 token domain per network instead of defaulting to mainnet (Issue #3)', () => {
    const authData = {
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: '1000000',
      validAfter: 0,
      validBefore: 1800000000,
      nonce: '0x' + '00'.repeat(32),
    };

    const sepolia = buildTransferAuthorizationTypedData(
      {
        network: 'eip155:84532',
        chainId: 84532,
        verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      },
      authData
    );
    expect(sepolia.domain.name).toBe('USDC');

    const mainnet = buildTransferAuthorizationTypedData(
      {
        network: 'eip155:8453',
        chainId: 8453,
        verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
      authData
    );
    expect(mainnet.domain.name).toBe('USD Coin');

    expect(() =>
      buildTransferAuthorizationTypedData(
        { chainId: 1, verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        authData
      )
    ).toThrow(/domain `name` is required/);

    expect(() =>
      buildTransferAuthorizationTypedData(
        { network: 'eip155:1', chainId: 1, verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        authData
      )
    ).toThrow(/Unknown x402 network/);
  });
});
