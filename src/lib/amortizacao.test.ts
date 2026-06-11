import { describe, it, expect } from 'vitest';
import { roundHalfEven, round2, monthlyRate, pmt, simulate, type SimulationInput } from './amortizacao';

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

const V1: SimulationInput = { capital: 150000, installments: 360, annualRatePct: 3.5, amortization: 10000 };
const V2: SimulationInput = { capital: 200000, installments: 300, annualRatePct: 4.0, amortization: 25000 };
const V3: SimulationInput = { capital: 135000, installments: 360, annualRatePct: 3.5, amortization: 7000 };

describe('simulate — Valores Atuais (Layer A)', () => {
  it('V1 current column', () => {
    const r = simulate(V1, 'reduceTerm');
    expect(r.current).toEqual({ interest: 437.5, principal: 236.07, installment: 673.57, remaining: 360 });
  });
  it('V2 current installment is the SUM OF ROUNDED PARTS (1055.68, not round2(pmt)=1055.67)', () => {
    const r = simulate(V2, 'reduceTerm');
    expect(r.current).toEqual({ interest: 666.67, principal: 389.01, installment: 1055.68, remaining: 300 });
  });
});

describe('simulate — Diminuir Prazo (reduceTerm)', () => {
  it('V1 (LIVE)', () => {
    const r = simulate(V1, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 408.33, principal: 265.23, installment: 673.56, remaining: 320 });
    expect(r.diff).toEqual({ interest: -29.17, principal: 29.16, installment: -0.01, remaining: -40 });
  });
  it('V2 (LIVE): capital must come from pmt at the FRACTIONAL 2dp term (472.35, not 472.34)', () => {
    const r = simulate(V2, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 583.33, principal: 472.35, installment: 1055.68, remaining: 242 });
    expect(r.diff).toEqual({ interest: -83.34, principal: 83.34, installment: 0, remaining: -58 });
  });
  it('V3 (LIVE): term 328.495248 -> 328.50 -> banker\'s -> 328 (ceil/half-up=329 must fail)', () => {
    const r = simulate(V3, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 373.33, principal: 232.87, installment: 606.2, remaining: 328 });
  });
  it('V4 (MODEL)', () => {
    const r = simulate({ capital: 100000, installments: 180, annualRatePct: 2.75, amortization: 5000 }, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 217.71, principal: 460.92, installment: 678.63, remaining: 169 });
  });
  it('V5 (MODEL)', () => {
    const r = simulate({ capital: 80000, installments: 120, annualRatePct: 6.0, amortization: 15000 }, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 325, principal: 563.2, installment: 888.2, remaining: 91 });
  });
  it('V6 zero rate', () => {
    const r = simulate({ capital: 120000, installments: 240, annualRatePct: 0, amortization: 20000 }, 'reduceTerm');
    expect(r.current).toEqual({ interest: 0, principal: 500, installment: 500, remaining: 240 });
    expect(r.updated).toEqual({ interest: 0, principal: 500, installment: 500, remaining: 200 });
    expect(r.diff.remaining).toBe(-40);
  });
  it('V7 full payoff: all zeros', () => {
    const r = simulate({ capital: 50000, installments: 60, annualRatePct: 3.0, amortization: 50000 }, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 0, principal: 0, installment: 0, remaining: 0 });
  });
  it('V8 tiny residual clamps to one final installment (E4)', () => {
    const r = simulate({ capital: 50000, installments: 12, annualRatePct: 3.0, amortization: 49900 }, 'reduceTerm');
    expect(r.updated).toEqual({ interest: 0.25, principal: 100, installment: 100.25, remaining: 1 });
  });
});

describe('simulate — Diminuir Prestação (reduceInstallment)', () => {
  it('V1 (LIVE)', () => {
    const r = simulate(V1, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 408.33, principal: 220.33, installment: 628.66, remaining: 360 });
    expect(r.diff).toEqual({ interest: -29.17, principal: -15.74, installment: -44.91, remaining: 0 });
  });
  it('V2 (LIVE)', () => {
    const r = simulate(V2, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 583.33, principal: 340.38, installment: 923.71, remaining: 300 });
  });
  it('V3 (MODEL)', () => {
    const r = simulate(V3, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 373.33, principal: 201.44, installment: 574.77, remaining: 360 });
  });
  it('V4 (MODEL)', () => {
    const r = simulate({ capital: 100000, installments: 180, annualRatePct: 2.75, amortization: 5000 }, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 217.71, principal: 426.98, installment: 644.69, remaining: 180 });
  });
  it('V5 (MODEL)', () => {
    const r = simulate({ capital: 80000, installments: 120, annualRatePct: 6.0, amortization: 15000 }, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 325, principal: 396.63, installment: 721.63, remaining: 120 });
  });
  it('V7 full payoff: all zeros for this strategy too', () => {
    const r = simulate({ capital: 50000, installments: 60, annualRatePct: 3.0, amortization: 50000 }, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 0, principal: 0, installment: 0, remaining: 0 });
  });
  it('V6 zero rate', () => {
    const r = simulate({ capital: 120000, installments: 240, annualRatePct: 0, amortization: 20000 }, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 0, principal: 416.67, installment: 416.67, remaining: 240 });
  });
  it('V8 tiny residual (well-defined for this strategy)', () => {
    const r = simulate({ capital: 50000, installments: 12, annualRatePct: 3.0, amortization: 49900 }, 'reduceInstallment');
    expect(r.updated).toEqual({ interest: 0.25, principal: 8.22, installment: 8.47, remaining: 12 });
  });
});
