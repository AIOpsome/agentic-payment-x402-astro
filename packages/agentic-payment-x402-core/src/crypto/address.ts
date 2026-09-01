/**
 * EVM Address verification and checksumming utilities.
 */

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEthereumAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false;
  return ETH_ADDRESS_REGEX.test(address.trim());
}

export function normalizeAddress(address: string): string {
  if (!isValidEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return address.trim().toLowerCase();
}
