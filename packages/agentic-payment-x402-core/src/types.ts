/**
 * Core types for x402 Protocol v2 payments and settlement.
 */

export interface PaymentRequirements {
  scheme: 'exact';
  network: string; // e.g. 'eip155:8453'
  amount: string; // Atomic units (e.g. '1000000' for 1.00 USDC)
  asset: string; // ERC-20 contract address (e.g. '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
  payTo: string; // Merchant payee wallet address
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

export interface AuthorizationData {
  from: string;
  to: string;
  value: string;
  validAfter: number | string;
  validBefore: number | string;
  nonce: string; // 32-byte hex
}

export interface PaymentPayload {
  x402Version: 2;
  accepted: PaymentRequirements;
  payload: {
    signature: string;
    authorization: AuthorizationData;
  };
}

export interface SettlementResult {
  success: boolean;
  txHash?: string | null;
  settledAmount?: number | string | null;
  payer?: string | null;
  facilitator?: string | null;
  message?: string | null;
  rawResponse?: Record<string, unknown>;
}

export interface FacilitatorConfig {
  url: string;
  apiKeyId?: string;
  apiKeySecret?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface NetworkConfig {
  caip2: string;
  chainId: number;
  name: string;
  isTestnet: boolean;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}
