/**
 * High-precision atomic unit conversions avoiding floating point errors.
 */

/**
 * Scales standard currency units (e.g. $10.50 USD) to asset base units (e.g. '10500000' for 6 decimals).
 * Sub-unit precision is rounded half-up (the conventional currency rounding policy), never truncated.
 * Rejects negative, zero, and non-numeric values.
 *
 * @param amount Amount in major currency units (e.g. 10.50 or '10.50')
 * @param assetDecimals Atomic decimals of the stablecoin (default 6 for USDC)
 */
export function scaleToAssetUnits(amount: number | string, assetDecimals = 6): string {
  // String(1e-7) yields exponential notation, which the decimal grammar below rejects; expanding it
  // keeps scaleToAssetUnits(0.0000005) and scaleToAssetUnits('0.0000005') behaving identically.
  const raw =
    typeof amount === 'number'
      ? Number.isFinite(amount) && /e/i.test(String(amount))
        ? amount.toFixed(assetDecimals + 1)
        : String(amount)
      : String(amount).trim();
  const normalized = raw.startsWith('+') ? raw.slice(1) : raw;

  if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error(`Amount must be a positive number greater than zero, received: ${amount}`);
  }

  const [whole, fraction = ''] = normalized.split('.');
  let units = BigInt(whole + fraction.slice(0, assetDecimals).padEnd(assetDecimals, '0'));

  const roundingDigit = fraction[assetDecimals];
  if (roundingDigit !== undefined && Number(roundingDigit) >= 5) {
    units += 1n;
  }

  if (units <= 0n) {
    throw new Error(`Scaled amount resulted in zero units: ${amount}`);
  }
  return units.toString();
}

/**
 * Formats atomic units back to human-readable decimal string.
 */
export function formatAssetUnits(atomicUnits: string | bigint, assetDecimals = 6): string {
  const str = atomicUnits.toString().padStart(assetDecimals + 1, '0');
  const splitIdx = str.length - assetDecimals;
  const whole = str.slice(0, splitIdx) || '0';
  const fraction = str.slice(splitIdx).replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}
