import type { AstroIntegration } from 'astro';
import type { AgenticPayAstroOptions } from './types.js';

export const NETWORK_DEFAULT_ASSETS: Record<string, string> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
};

export const DEFAULT_NETWORK = 'eip155:8453';
export const DEFAULT_BASE_USDC = NETWORK_DEFAULT_ASSETS[DEFAULT_NETWORK];

export function getDefaultAssetForNetwork(network: string): string {
  return NETWORK_DEFAULT_ASSETS[network] || DEFAULT_BASE_USDC;
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
