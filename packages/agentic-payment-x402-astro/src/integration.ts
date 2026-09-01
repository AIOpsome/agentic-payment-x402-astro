import type { AstroIntegration } from 'astro';
import type { AgenticPayAstroOptions } from './types.js';

export const DEFAULT_BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const DEFAULT_NETWORK = 'eip155:8453';

/**
 * Astro Integration enabling Agentic Pay x402 payment protocol.
 */
export function agenticPay(options: AgenticPayAstroOptions): AstroIntegration {
  return {
    name: 'agentic-payment-x402-astro',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        // Expose configuration via environment or Astro virtual module
        updateConfig({
          vite: {
            define: {
              '__AGENTIC_PAY_CONFIG__': JSON.stringify({
                payTo: options.payTo,
                network: options.network || DEFAULT_NETWORK,
                asset: options.asset || DEFAULT_BASE_USDC,
                assetDecimals: options.assetDecimals ?? 6,
              }),
            },
          },
        });
      },
    },
  };
}
