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
});
