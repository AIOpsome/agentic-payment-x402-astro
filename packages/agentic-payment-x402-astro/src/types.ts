import type { FacilitatorConfig } from 'agentic-payment-x402-core';

export interface RoutePriceConfig {
  amount: number | string; // e.g. 5.0 for $5.00 or '5000000' atomic units
  description?: string;
  asset?: string;
  payTo?: string;
}

export interface AgenticPayAstroOptions {
  payTo: string;
  network?: string; // default 'eip155:8453' (Base Mainnet) or 'eip155:84532' (Base Sepolia)
  asset?: string; // default USDC on configured network
  assetDecimals?: number; // default 6
  facilitators?: Array<string | FacilitatorConfig>;
  protectedRoutes?: Record<string, RoutePriceConfig | number | string>;
  resolveOrderAmount?: (requestData: Record<string, unknown>) => Promise<number | string> | number | string;
  debug?: boolean;
}
