/**
 * Browser Wallet signing workflows for x402 EIP-3009 authorizations.
 */

import { buildTransferAuthorizationTypedData } from '../crypto/eip712.js';
import { generateNonce } from '../crypto/nonce.js';
import type { PaymentPayload, PaymentRequirements } from '../types.js';
import {
  detectEthereumProvider,
  switchOrAddNetwork,
  KNOWN_NETWORKS_BY_CAIP2,
  type Eip1193Provider,
} from './provider.js';

export interface SignPaymentOptions {
  provider?: Eip1193Provider;
  requirements: PaymentRequirements;
  tokenName?: string;
  tokenVersion?: string;
  timeoutSeconds?: number;
}

/**
 * Connects wallet, switches network, requests EIP-712 signature for EIP-3009 transfer,
 * and formats the resulting x402 v2 PaymentPayload.
 */
export async function signPaymentAuthorization(
  options: SignPaymentOptions
): Promise<PaymentPayload> {
  const provider = options.provider || (await detectEthereumProvider());
  if (!provider) {
    throw new Error('No Web3/EIP-1193 Ethereum wallet detected. Please install a wallet extension.');
  }

  // 1. Extract chainId and network config from CAIP-2 (e.g. 'eip155:8453' -> 8453)
  const networkKey = options.requirements.network;
  const chainId = parseInt(networkKey.split(':')[1] || '8453', 10);
  const networkDefaults = KNOWN_NETWORKS_BY_CAIP2[networkKey];

  // 2. Request account connection
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet connection rejected or no accounts available.');
  }
  const payerAddress = accounts[0];

  // 3. Ensure correct network
  await switchOrAddNetwork(provider, chainId);

  // 4. Construct EIP-3009 parameters
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validBefore = now + (options.timeoutSeconds || options.requirements.maxTimeoutSeconds || 3600);
  const nonce = generateNonce();

  const authData = {
    from: payerAddress,
    to: options.requirements.payTo,
    value: options.requirements.amount,
    validAfter,
    validBefore,
    nonce,
  };

  // 5. Build EIP-712 payload with network-correct domain defaults
  const tokenName = options.tokenName || networkDefaults?.defaultTokenName || 'USD Coin';
  const tokenVersion = options.tokenVersion || networkDefaults?.defaultTokenVersion || '2';
  const verifyingContract = options.requirements.asset || networkDefaults?.defaultAsset;

  const typedData = buildTransferAuthorizationTypedData(
    {
      name: tokenName,
      version: tokenVersion,
      chainId,
      verifyingContract,
    },
    authData
  );

  // 6. Request EIP-712 signature
  const signature = (await provider.request({
    method: 'eth_signTypedData_v4',
    params: [payerAddress, JSON.stringify(typedData)],
  })) as string;

  return {
    x402Version: 2,
    accepted: options.requirements,
    payload: {
      signature,
      authorization: authData,
    },
  };
}
