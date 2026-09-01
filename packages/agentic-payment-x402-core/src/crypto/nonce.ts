/**
 * 32-byte Cryptographic Nonce generator using standard CSPRNG.
 */

export function generateNonce(): string {
  // 1. Web Cryptography API (Browser, Modern Node, Bun, Deno, Edge)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return (
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  // 2. Node.js native crypto module
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      const bytes = nodeCrypto.randomBytes(32);
      return '0x' + bytes.toString('hex');
    }
  } catch {
    // Fall through to error
  }

  throw new Error('No cryptographically secure random number generator (CSPRNG) available in this environment.');
}
