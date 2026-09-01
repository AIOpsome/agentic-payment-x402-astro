import { describe, expect, it } from 'vitest';
import { getDefaultAssetForNetwork, NETWORK_DEFAULT_ASSETS, agenticPay } from '../src/integration.js';
import { createX402Middleware } from '../src/middleware.js';

const PAY_TO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

describe('Network defaults (Issue #3)', () => {
  it('resolves known networks to their own USDC contract', () => {
    expect(getDefaultAssetForNetwork('eip155:8453')).toBe(NETWORK_DEFAULT_ASSETS['eip155:8453']);
    expect(getDefaultAssetForNetwork('eip155:84532')).toBe(NETWORK_DEFAULT_ASSETS['eip155:84532']);
    expect(getDefaultAssetForNetwork('eip155:84532')).not.toBe(getDefaultAssetForNetwork('eip155:8453'));
  });

  it('throws for unknown networks instead of defaulting to Base mainnet USDC', () => {
    for (const network of ['eip155:1', 'eip155:137', 'eip155:42161', 'solana:mainnet']) {
      expect(() => getDefaultAssetForNetwork(network)).toThrow(/Unknown x402 network/);
    }
  });

  it('fails loudly when configured with an unknown network and no explicit asset', () => {
    expect(() => createX402Middleware({ payTo: PAY_TO, network: 'eip155:1' })).toThrow(
      /Unknown x402 network/
    );
    expect(() => agenticPay({ payTo: PAY_TO, network: 'eip155:1' })).toThrow(/Unknown x402 network/);
  });

  it('accepts an unknown network when an explicit asset is supplied', () => {
    expect(() =>
      createX402Middleware({
        payTo: PAY_TO,
        network: 'eip155:1',
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      })
    ).not.toThrow();
  });
});
