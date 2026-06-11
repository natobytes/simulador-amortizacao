import { describe, it, expect } from 'vitest';
import { roundHalfEven, round2, monthlyRate, pmt, simulate, type SimulationInput, validate, buildSchedule, buildSchedules, repaymentCost, computeSavings } from './amortizacao';

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

describe('validate', () => {
  const ok = { capital: 150000, installments: 360, annualRatePct: 3.5, amortization: 10000, commissionRatePct: 0.5 };
  it('accepts valid input', () => {
    expect(validate(ok)).toEqual({});
  });
  it('requires all main fields', () => {
    const e = validate({ capital: null, installments: null, annualRatePct: null, amortization: null, commissionRatePct: null });
    expect(e).toEqual({ capital: 'required', installments: 'required', rate: 'required', amortization: 'required' });
  });
  it('rejects non-positive capital and amortization', () => {
    expect(validate({ ...ok, capital: 0 }).capital).toBe('positive');
    expect(validate({ ...ok, amortization: 0 }).amortization).toBe('positive');
  });
  it('rejects fractional or < 1 installments', () => {
    expect(validate({ ...ok, installments: 0 }).installments).toBe('positive');
    expect(validate({ ...ok, installments: 12.5 }).installments).toBe('integer');
  });
  it('rejects negative rate but accepts 0', () => {
    expect(validate({ ...ok, annualRatePct: -1 }).rate).toBe('negative');
    expect(validate({ ...ok, annualRatePct: 0 })).toEqual({});
  });
  it('amortization may equal capital (full payoff) but not exceed it', () => {
    expect(validate({ ...ok, amortization: 150000 })).toEqual({});
    expect(validate({ ...ok, amortization: 150001 }).amortization).toBe('exceedsCapital');
    // V7 literal: A=50001 on B=50000 is a validation error
    expect(validate({ ...ok, capital: 50000, amortization: 50001 }).amortization).toBe('exceedsCapital');
  });
  it('rejects negative commission, accepts null (treated as 0 upstream)', () => {
    expect(validate({ ...ok, commissionRatePct: -0.5 }).commission).toBe('negative');
    expect(validate({ ...ok, commissionRatePct: null })).toEqual({});
  });
});

describe('buildSchedule (Layer B, full precision)', () => {
  it('baseline V1: n months, balance reaches 0, sums are consistent', () => {
    const s = buildSchedule(150000, monthlyRate(3.5), 673.567032);
    expect(s.months).toBe(360);
    expect(s.rows[s.rows.length - 1]!.balance).toBeCloseTo(0, 6);
    const sumPrincipal = s.rows.reduce((acc, r) => acc + r.principal, 0);
    expect(sumPrincipal).toBeCloseTo(150000, 4);
    expect(s.totalInterest).toBeCloseTo(92484.13, 0); // pmt*360 - 150000
    expect(s.totalPaid).toBeCloseTo(150000 + s.totalInterest, 4);
  });
  it('zero-rate schedule has zero interest', () => {
    const s = buildSchedule(120000, 0, 500);
    expect(s.months).toBe(240);
    expect(s.totalInterest).toBe(0);
  });
});

describe('buildSchedules (per strategy)', () => {
  it('reduceTerm keeps the old payment and ends around month 320-321', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    expect(baseline.months).toBe(360);
    expect(scenario.months).toBeGreaterThanOrEqual(320);
    expect(scenario.months).toBeLessThanOrEqual(321);
    expect(scenario.rows[0]!.payment).toBeCloseTo(673.567032, 5);
    expect(scenario.totalInterest).toBeLessThan(baseline.totalInterest);
  });
  it('reduceInstallment keeps the term with the lower payment', () => {
    const { scenario } = buildSchedules(V1, 'reduceInstallment');
    expect(scenario.months).toBe(360);
    expect(scenario.rows[0]!.payment).toBeCloseTo(628.662563, 5);
  });
  it('full payoff yields an empty scenario schedule', () => {
    const { scenario } = buildSchedules({ ...V1, amortization: 150000 }, 'reduceTerm');
    expect(scenario.months).toBe(0);
    expect(scenario.totalInterest).toBe(0);
  });
  it('reduceTerm saves more interest than reduceInstallment', () => {
    const term = buildSchedules(V1, 'reduceTerm').scenario.totalInterest;
    const inst = buildSchedules(V1, 'reduceInstallment').scenario.totalInterest;
    expect(term).toBeLessThan(inst);
  });
});

describe('repaymentCost', () => {
  it('commission plus 4% stamp duty', () => {
    expect(repaymentCost(10000, 0.5)).toEqual({ commission: 50, stampDuty: 2, total: 52 });
    expect(repaymentCost(10000, 2)).toEqual({ commission: 200, stampDuty: 8, total: 208 });
  });
  it('no commission -> no stamp duty', () => {
    expect(repaymentCost(10000, 0)).toEqual({ commission: 0, stampDuty: 0, total: 0 });
  });
});

describe('computeSavings', () => {
  it('net savings = interest saved minus costs', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(s.interestSaved).toBeGreaterThan(0);
    expect(s.cost.total).toBe(52);
    expect(s.netSavings).toBeCloseTo(s.interestSaved - 52, 2);
  });
  it('totalBefore is the rounded baseline lifetime total (V1: 242484.13)', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(s.totalBefore).toBe(round2(baseline.totalPaid));
    expect(s.totalBefore).toBe(242484.13);
  });
  it('totalAfter = scenario payments + lump sum + costs (V1: 225593.76)', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(s.totalAfter).toBe(round2(scenario.totalPaid + V1.amortization + s.cost.total));
    expect(s.totalAfter).toBe(225593.76);
  });
  it('totalAfter sums actual cash flows, NOT totalBefore − netSavings (V2 separates them by 1 cent)', () => {
    const { baseline, scenario } = buildSchedules(V2, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V2.amortization, 0.5);
    expect(s.totalAfter).toBe(round2(scenario.totalPaid + V2.amortization + s.cost.total));
    // The back-derived round2(totalBefore − netSavings) gives 280257.44 — must fail here.
    expect(s.totalAfter).toBe(280257.45);
    expect(s.totalBefore).toBe(316702.1);
  });
  it('totalBefore − totalAfter ≈ netSavings within 0.02 (both strategies)', () => {
    for (const strategy of ['reduceTerm', 'reduceInstallment'] as const) {
      const { baseline, scenario } = buildSchedules(V1, strategy);
      const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
      expect(Math.abs(s.totalBefore - s.totalAfter - s.netSavings)).toBeLessThanOrEqual(0.02);
    }
  });
  it('full payoff: totalAfter is capital plus costs, and beats totalBefore when rate > 0', () => {
    const input = { ...V1, amortization: V1.capital };
    const { baseline, scenario } = buildSchedules(input, 'reduceTerm');
    const s = computeSavings(baseline, scenario, input.amortization, 0.5);
    expect(s.totalAfter).toBe(round2(input.capital + s.cost.total));
    expect(s.totalBefore).toBeGreaterThan(s.totalAfter);
  });
  it('zero commission: totalAfter excludes any cost component', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0);
    expect(s.cost.total).toBe(0);
    expect(s.totalAfter).toBe(round2(scenario.totalPaid + V1.amortization));
  });
});
