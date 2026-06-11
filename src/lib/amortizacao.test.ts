import { describe, it, expect } from 'vitest';
import { roundHalfEven, round2, monthlyRate, pmt } from './amortizacao';

describe('roundHalfEven (V9)', () => {
  it('rounds 2dp half-to-even', () => {
    expect(roundHalfEven(153.8386, 2)).toBe(153.84); // truncation 153.83 must fail
    expect(roundHalfEven(211.4361, 2)).toBe(211.44); // truncation 211.43 must fail
    expect(roundHalfEven(151.4955, 2)).toBe(151.5);
  });
  it('rounds integers half-to-even at exact .50', () => {
    expect(roundHalfEven(328.5, 0)).toBe(328); // half-up 329 must fail
    expect(roundHalfEven(151.5, 0)).toBe(152);
    expect(roundHalfEven(213.5, 0)).toBe(214);
  });
  it('two-stage rounding: 151.4955 -> 151.50 -> 152 (direct int rounding gives 151)', () => {
    expect(roundHalfEven(roundHalfEven(151.4955, 2), 0)).toBe(152);
    expect(roundHalfEven(151.4955, 0)).toBe(151);
  });
  it('handles negative values (difference columns)', () => {
    expect(round2(408.33 - 437.5)).toBe(-29.17);
    expect(round2(666.67 - 833.33)).toBe(-166.66);
  });
});

describe('pmt', () => {
  it('computes the French-system payment', () => {
    expect(pmt(150000, monthlyRate(3.5), 360)).toBeCloseTo(673.567032, 5);
    expect(pmt(200000, monthlyRate(4.0), 300)).toBeCloseTo(1055.673681, 5);
    expect(pmt(135000, monthlyRate(3.5), 360)).toBeCloseTo(606.210329, 5);
  });
  it('zero rate is linear', () => {
    expect(pmt(120000, 0, 240)).toBe(500);
  });
  it('supports fractional months (reduce-term recompute)', () => {
    expect(pmt(175000, monthlyRate(4.0), 241.67)).toBeCloseTo(1055.680151, 5);
  });
});
