import { describe, expect, it } from 'vitest';
import { formatAssetUnits, scaleToAssetUnits } from '../src/utils/amount.js';

describe('Amount scaling and formatting', () => {
  it('scales dollar amounts to 6-decimal USDC atomic units', () => {
    expect(scaleToAssetUnits(1)).toBe('1000000');
    expect(scaleToAssetUnits(10.5)).toBe('10500000');
    expect(scaleToAssetUnits('2500')).toBe('2500000000');
    expect(scaleToAssetUnits('0.05')).toBe('50000');
  });

  it('formats atomic units back to decimal strings', () => {
    expect(formatAssetUnits('1000000')).toBe('1');
    expect(formatAssetUnits('10500000')).toBe('10.5');
    expect(formatAssetUnits('2500000000')).toBe('2500');
    expect(formatAssetUnits('50000')).toBe('0.05');
  });

  it('rejects zero, negative, or invalid amounts', () => {
    expect(() => scaleToAssetUnits(0)).toThrow(/positive number greater than zero/);
    expect(() => scaleToAssetUnits(-10)).toThrow(/positive number greater than zero/);
    expect(() => scaleToAssetUnits('-5.00')).toThrow(/positive number greater than zero/);
    expect(() => scaleToAssetUnits('invalid')).toThrow(/positive number greater than zero/);
  });

  it('rounds sub-unit precision half-up instead of truncating (Issue #7)', () => {
    expect(scaleToAssetUnits('10.9999999')).toBe('11000000');
    expect(scaleToAssetUnits('0.0000005')).toBe('1');
    expect(scaleToAssetUnits('1.2345675')).toBe('1234568');
    expect(scaleToAssetUnits('1.2345674')).toBe('1234567');
    expect(scaleToAssetUnits(10.9999999)).toBe('11000000');
    expect(scaleToAssetUnits('1.005', 2)).toBe('101');
  });

  it('rejects amounts that round down to zero units', () => {
    expect(() => scaleToAssetUnits('0.0000004')).toThrow(/zero units/);
  });

  it('rejects malformed numeric strings', () => {
    expect(() => scaleToAssetUnits('1.2.3')).toThrow(/positive number greater than zero/);
    expect(() => scaleToAssetUnits('1e6')).toThrow(/positive number greater than zero/);
    expect(() => scaleToAssetUnits('$5.00')).toThrow(/positive number greater than zero/);
  });

  it('treats a small JS number the same as its string form', () => {
    // String(5e-7) is exponential notation, which the decimal grammar rejects; the two forms must
    // not disagree, or a resolver returning a number 500s where the string equivalent settles.
    expect(scaleToAssetUnits(0.0000005)).toBe(scaleToAssetUnits('0.0000005'));
    expect(scaleToAssetUnits(0.0000005)).toBe('1');
  });

  it('is re-exported from the client entry the checkout components import from', async () => {
    // The button's inline script does `import { scaleToAssetUnits } from '.../core/client'`; without
    // this export the Astro client bundle fails to build.
    const clientEntry = await import('../src/client/index.js');
    expect(clientEntry.scaleToAssetUnits).toBe(scaleToAssetUnits);
  });
});
