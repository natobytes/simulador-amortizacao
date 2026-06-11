/**
 * Early-repayment engine.
 * Layer A replicates twinkloo.pt's server model exactly (verified against 25 live
 * probes — see docs/superpowers/specs/2026-06-10-simulador-amortizacao-design.md §3).
 * All "next installment" money values round half-to-even (the .NET Math.Round default).
 */

/** Round half-to-even at `decimals` places (.NET Math.Round semantics on doubles). */
export function roundHalfEven(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const EPS = 1e-9;
  let result: number;
  if (Math.abs(diff - 0.5) < EPS) {
    result = floor % 2 === 0 ? floor : floor + 1;
  } else {
    result = Math.round(scaled);
  }
  return result / factor;
}

export const round2 = (value: number): number => roundHalfEven(value, 2);

/** Nominal monthly rate: TAN (percent) / 100 / 12, never rounded. */
export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

/** French-system constant installment. Supports fractional `months`. */
export function pmt(principal: number, i: number, months: number): number {
  if (months <= 0) return 0;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - (1 + i) ** -months);
}
