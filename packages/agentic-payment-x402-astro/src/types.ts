import type { FacilitatorConfig } from 'agentic-payment-x402-core';

export interface RoutePriceConfig {
  /** Price in major currency units, never atomic units: 5.0 or '5.00' both mean $5.00 USDC. */
  amount: number | string;
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
  /**
   * Server-side price lookup for the settlement endpoint, in major currency units.
   * Required by `createX402SettlementHandler`: the request body is attacker-controlled, so the
   * amount that gets settled must be derived from merchant-side state (order record, cart, catalog).
   */
  resolveOrderAmount?: (
    requestData: Record<string, unknown>
  ) => Promise<number | string | null | undefined> | number | string | null | undefined;
  debug?: boolean;
}
