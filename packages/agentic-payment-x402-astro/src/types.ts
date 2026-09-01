import type { FacilitatorConfig } from 'agentic-payment-x402-core';

export interface RoutePriceConfig {
  amount: number | string; // e.g. 0.05 for $0.05 or '1000000'
  description?: string;
  asset?: string;
  payTo?: string;
}

export interface AgenticPayAstroOptions {
  payTo: string;
  network?: string; // default 'eip155:8453' (Base Mainnet)
  asset?: string; // default USDC on Base
  assetDecimals?: number; // default 6
  facilitators?: Array<string | FacilitatorConfig>;
  protectedRoutes?: Record<string, RoutePriceConfig | number | string>;
  debug?: boolean;
}
