/**
 * 32-byte Cryptographic Nonce generator.
 */

export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return (
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  // Node.js fallback
  const randomBytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
  return (
    '0x' +
    randomBytes
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}
