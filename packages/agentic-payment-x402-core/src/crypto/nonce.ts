/**
 * 32-byte Cryptographic Nonce generator using standard CSPRNG.
 */

function toHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function generateNonce(): string {
  // 1. Web Cryptography API (Browser, Node 18+, Bun, Deno, Edge)
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    webCrypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  // 2. Node CJS builds only. `require` is not defined in the ESM build, so referencing it
  //    unguarded there is a ReferenceError rather than a fallback.
  const nodeRequire =
    typeof require === 'function'
      ? (require as unknown as (id: string) => { randomBytes?: (n: number) => Uint8Array })
      : undefined;
  if (nodeRequire) {
    try {
      const nodeCrypto = nodeRequire('node:crypto');
      if (typeof nodeCrypto?.randomBytes === 'function') {
        return toHex(new Uint8Array(nodeCrypto.randomBytes(32)));
      }
    } catch {
      // Bundled ESM output shims `require` with a thrower; fall through to the explicit error below.
    }
  }

  throw new Error(
    'No cryptographically secure random number generator (CSPRNG) available in this environment. ' +
      'Use a runtime exposing globalThis.crypto (Node 18+, Bun, Deno, modern browsers, edge runtimes) ' +
      'or install a Web Crypto polyfill before generating x402 nonces.'
  );
}
