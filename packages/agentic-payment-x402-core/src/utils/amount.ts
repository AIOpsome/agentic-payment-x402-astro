/**
 * High-precision atomic unit conversions avoiding floating point errors.
 */

/**
 * Scales standard currency units (e.g. $10.50 USD or 1050 cents) to asset base units (e.g. 10500000 for 6 decimals).
 *
 * @param amount Amount in major currency units (e.g. 10.50) or string
 * @param assetDecimals Atomic decimals of the stablecoin (default 6 for USDC)
 */
export function scaleToAssetUnits(amount: number | string, assetDecimals = 6): string {
  const str = typeof amount === 'number' ? amount.toFixed(assetDecimals) : amount.trim();
  const [whole, fraction = ''] = str.split('.');
  
  const cleanWhole = whole.replace(/[^0-9-]/g, '') || '0';
  const cleanFraction = fraction.replace(/[^0-9]/g, '').slice(0, assetDecimals).padEnd(assetDecimals, '0');
  
  const combined = `${cleanWhole}${cleanFraction}`.replace(/^0+/, '') || '0';
  return combined;
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
