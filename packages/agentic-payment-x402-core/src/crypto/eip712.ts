/**
 * EIP-712 and EIP-3009 Typed Data structure builders for TransferWithAuthorization.
 */

import type { AuthorizationData } from '../types.js';

export interface Eip712DomainParams {
  name?: string;
  version?: string;
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
      name: domainParams.name || 'USD Coin',
      version: domainParams.version || '2',
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
