/**
 * Single source of truth for supported x402 networks and their default settlement asset
 * plus EIP-712 token domain (name/version). Every network-dependent default in this
 * package resolves through this table.
 */

import type { NetworkConfig } from './types.js';

export interface ExtendedNetworkConfig extends NetworkConfig {
  defaultAsset: string;
  defaultTokenName: string;
  defaultTokenVersion: string;
}

export const BASE_MAINNET: ExtendedNetworkConfig = {
  caip2: 'eip155:8453',
  chainId: 8453,
  name: 'Base',
  isTestnet: false,
  rpcUrl: 'https://mainnet.base.org',
  blockExplorerUrl: 'https://basescan.org',
  defaultAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  defaultTokenName: 'USD Coin',
  defaultTokenVersion: '2',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
};

export const BASE_SEPOLIA: ExtendedNetworkConfig = {
  caip2: 'eip155:84532',
  chainId: 84532,
  name: 'Base Sepolia',
  isTestnet: true,
  rpcUrl: 'https://sepolia.base.org',
  blockExplorerUrl: 'https://sepolia.basescan.org',
  defaultAsset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  defaultTokenName: 'USDC',
  defaultTokenVersion: '2',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
};

export const KNOWN_NETWORKS: Record<number, ExtendedNetworkConfig> = {
  8453: BASE_MAINNET,
  84532: BASE_SEPOLIA,
};

export const KNOWN_NETWORKS_BY_CAIP2: Record<string, ExtendedNetworkConfig> = {
  'eip155:8453': BASE_MAINNET,
  'eip155:84532': BASE_SEPOLIA,
};

export interface TokenDomain {
  name: string;
  version: string;
  asset: string;
}

/**
 * Resolves the EIP-712 token domain and default asset for a CAIP-2 network.
 * Throws for unknown networks rather than silently defaulting to Base mainnet USDC.
 */
export function getTokenDomainForNetwork(network: string): TokenDomain {
  const config = KNOWN_NETWORKS_BY_CAIP2[network];
  if (!config) {
    throw new Error(
      `Unknown x402 network "${network}": no default asset or EIP-712 token domain is known. ` +
        `Supported networks: ${Object.keys(KNOWN_NETWORKS_BY_CAIP2).join(', ')}. ` +
        `Pass an explicit asset address and token name/version for other networks.`
    );
  }
  return {
    name: config.defaultTokenName,
    version: config.defaultTokenVersion,
    asset: config.defaultAsset,
  };
}
