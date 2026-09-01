import type { AstroIntegration } from 'astro';
import { KNOWN_NETWORKS_BY_CAIP2 } from 'agentic-payment-x402-core';
import type { AgenticPayAstroOptions } from './types.js';

export const NETWORK_DEFAULT_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_NETWORKS_BY_CAIP2).map(([caip2, config]) => [caip2, config.defaultAsset])
);

export const DEFAULT_NETWORK = 'eip155:8453';
export const DEFAULT_BASE_USDC = NETWORK_DEFAULT_ASSETS[DEFAULT_NETWORK];

/**
 * Resolves the default settlement asset for a network. Throws for unrecognized networks instead of
 * silently falling back to Base mainnet USDC, which would price and settle a payment on a chain the
 * merchant never configured.
 */
export function getDefaultAssetForNetwork(network: string): string {
  const asset = NETWORK_DEFAULT_ASSETS[network];
  if (!asset) {
    throw new Error(
      `Unknown x402 network "${network}": no default asset is known. ` +
        `Supported networks: ${Object.keys(NETWORK_DEFAULT_ASSETS).join(', ')}. ` +
        `Pass an explicit \`asset\` (ERC-20 contract address) in your agenticPay options for other networks.`
    );
  }
  return asset;
}

/**
 * Astro Integration enabling Agentic Pay x402 payment protocol.
 */
export function agenticPay(options: AgenticPayAstroOptions): AstroIntegration {
  const network = options.network || DEFAULT_NETWORK;
  const asset = options.asset || getDefaultAssetForNetwork(network);

  return {
    name: 'agentic-payment-x402-astro',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            define: {
              '__AGENTIC_PAY_CONFIG__': JSON.stringify({
                payTo: options.payTo,
                network,
                asset,
                assetDecimals: options.assetDecimals ?? 6,
              }),
            },
          },
        });
      },
    },
  };
}
