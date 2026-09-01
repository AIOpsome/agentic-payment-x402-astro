/**
 * EIP-712 and EIP-3009 Typed Data structure builders for TransferWithAuthorization.
 */

import type { AuthorizationData } from '../types.js';
import { getTokenDomainForNetwork } from '../networks.js';

export interface Eip712DomainParams {
  /** Token contract EIP-712 domain name. Required unless `network` is supplied. */
  name?: string;
  /** Token contract EIP-712 domain version. Defaults to the value for `network`, else '2'. */
  version?: string;
  /** CAIP-2 network id (e.g. 'eip155:84532'); resolves name/version from the known-networks table. */
  network?: string;
  chainId: number;
  verifyingContract: string;
}

export interface Eip712TypedData {
  types: {
    EIP712Domain: Array<{ name: string; type: string }>;
    TransferWithAuthorization: Array<{ name: string; type: string }>;
  };
  primaryType: 'TransferWithAuthorization';
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message: {
    from: string;
    to: string;
    value: string;
    validAfter: string | number;
    validBefore: string | number;
    nonce: string;
  };
}

/**
 * Builds standard EIP-712 TypedData payload for EIP-3009 TransferWithAuthorization.
 */
export function buildTransferAuthorizationTypedData(
  domainParams: Eip712DomainParams,
  authData: AuthorizationData
): Eip712TypedData {
  const networkDomain = domainParams.network ? getTokenDomainForNetwork(domainParams.network) : undefined;
  const name = domainParams.name || networkDomain?.name;
  if (!name) {
    throw new Error(
      'EIP-712 domain `name` is required: pass the token contract name explicitly, or pass `network` ' +
        '(CAIP-2) so it can be resolved from the known-networks table. Token domain names differ per ' +
        'network (e.g. "USD Coin" on Base mainnet vs "USDC" on Base Sepolia) and a wrong name produces ' +
        'a signature the token contract will reject.'
    );
  }

  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    domain: {
      name,
      version: domainParams.version || networkDomain?.version || '2',
      chainId: domainParams.chainId,
      verifyingContract: domainParams.verifyingContract,
    },
    message: {
      from: authData.from,
      to: authData.to,
      value: authData.value,
      validAfter: authData.validAfter,
      validBefore: authData.validBefore,
      nonce: authData.nonce,
    },
  };
}
