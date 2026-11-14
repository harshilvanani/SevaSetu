import { describe, expect, it } from '@jest/globals';

import { coverFeeCents, formatCad, parseDollars } from '../donations';

describe('coverFeeCents', () => {
  it('adds enough that the organization keeps the full amount after 2.9% + 30¢', () => {
    for (const amount of [200, 2500, 5000, 10000, 123456]) {
      const total = amount + coverFeeCents(amount);
      const stripeFee = Math.round(total * 0.029) + 30;
      expect(total - stripeFee).toBeGreaterThanOrEqual(amount);
      expect(total - stripeFee - amount).toBeLessThanOrEqual(1);
    }
  });
  it('is $1.06 on a $25 gift', () => {
    expect(coverFeeCents(2500)).toBe(106);
  });
});

describe('parseDollars and formatCad', () => {
  it('reads common ways of typing an amount', () => {
    expect(parseDollars('25')).toBe(2500);
    expect(parseDollars('$12.50')).toBe(1250);
    expect(parseDollars('12,5')).toBe(1250);
    expect(parseDollars('abc')).toBeNull();
    expect(parseDollars('-5')).toBeNull();
  });
  it('formats Canadian dollars', () => {
    expect(formatCad(2500)).toBe('$25');
    expect(formatCad(1250)).toBe('$12.50');
  });
});
