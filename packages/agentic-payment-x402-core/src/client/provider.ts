/**
 * EIP-1193 Ethereum provider detection and chain management.
 */

import type { NetworkConfig } from '../types.js';

export const BASE_MAINNET: NetworkConfig = {
  caip2: 'eip155:8453',
  chainId: 8453,
  name: 'Base',
  isTestnet: false,
  rpcUrl: 'https://mainnet.base.org',
  blockExplorerUrl: 'https://basescan.org',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
};

export const BASE_SEPOLIA: NetworkConfig = {
  caip2: 'eip155:84532',
  chainId: 84532,
  name: 'Base Sepolia',
  isTestnet: true,
  rpcUrl: 'https://sepolia.base.org',
  blockExplorerUrl: 'https://sepolia.basescan.org',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
};

export const KNOWN_NETWORKS: Record<number, NetworkConfig> = {
  8453: BASE_MAINNET,
  84532: BASE_SEPOLIA,
};

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Detects an injected EIP-1193 provider (MetaMask, Coinbase Wallet, etc.) in the browser.
 */
export async function detectEthereumProvider(timeoutMs = 3000): Promise<Eip1193Provider | null> {
  if (typeof window === 'undefined') return null;

  const getProvider = (): Eip1193Provider | null => {
    const nav = window as unknown as { ethereum?: Eip1193Provider };
    return nav.ethereum || null;
  };

  const existing = getProvider();
  if (existing) return existing;

  return new Promise((resolve) => {
    let resolved = false;

    const handleEthereum = () => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('ethereum#initialized', handleEthereum);
      resolve(getProvider());
    };

    window.addEventListener('ethereum#initialized', handleEthereum);

    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('ethereum#initialized', handleEthereum);
      resolve(getProvider());
    }, timeoutMs);
  });
}

/**
 * Ensures the connected wallet is on the desired network, switching or prompting to add it.
 */
export async function switchOrAddNetwork(
  provider: Eip1193Provider,
  targetChainId: number
): Promise<void> {
  const chainIdHex = '0x' + targetChainId.toString(16);
  const currentChainHex = (await provider.request({ method: 'eth_chainId' })) as string;

  if (currentChainHex.toLowerCase() === chainIdHex.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number };
    // 4902 indicates chain has not been added to wallet
    if (err?.code === 4902) {
      const config = KNOWN_NETWORKS[targetChainId];
      if (!config) {
        throw new Error(`Chain ID ${targetChainId} is not in known network configurations.`);
      }

      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: config.name,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.blockExplorerUrl],
            nativeCurrency: config.nativeCurrency,
          },
        ],
      });
    } else {
      throw error;
    }
  }
}
