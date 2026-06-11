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

export type Strategy = 'reduceTerm' | 'reduceInstallment';

export interface SimulationInput {
  /** Capital em dívida (EUR). */
  capital: number;
  /** Nº de prestações em falta (months). */
  installments: number;
  /** TAN = spread + Euribor, in percent (e.g. 3.5). */
  annualRatePct: number;
  /** Valor a amortizar (EUR). */
  amortization: number;
}

/** Breakdown of the NEXT single monthly installment (not lifetime totals). */
export interface InstallmentBreakdown {
  interest: number;
  principal: number;
  installment: number;
  remaining: number;
}

export interface ScenarioResult {
  current: InstallmentBreakdown;
  updated: InstallmentBreakdown;
  diff: InstallmentBreakdown;
}

function breakdown(interest: number, principal: number, remaining: number): InstallmentBreakdown {
  const r2i = round2(interest);
  const r2p = round2(principal);
  // The displayed installment is the SUM of the independently rounded parts —
  // it may differ by 1 cent from round2(payment). This matches the live site.
  return { interest: r2i, principal: r2p, installment: round2(r2i + r2p), remaining };
}

export function simulate(input: SimulationInput, strategy: Strategy): ScenarioResult {
  const { capital: B, installments: n, amortization: A } = input;
  const i = monthlyRate(input.annualRatePct);
  const pmtOld = pmt(B, i, n);

  const current = breakdown(B * i, pmtOld - B * i, n);

  const Bn = B - A;
  let updated: InstallmentBreakdown;

  if (Bn <= 0) {
    updated = { interest: 0, principal: 0, installment: 0, remaining: 0 };
  } else if (strategy === 'reduceInstallment') {
    const pmtNew = pmt(Bn, i, n);
    updated = breakdown(Bn * i, pmtNew - Bn * i, n);
  } else {
    const nExact = i === 0 ? Bn / pmtOld : Math.log(pmtOld / (pmtOld - Bn * i)) / Math.log(1 + i);
    const nFrac = roundHalfEven(nExact, 2); // mandatory intermediate 2dp rounding
    if (nFrac < 1) {
      // E4: degenerate tiny residual — one final installment.
      updated = breakdown(Bn * i, Bn, 1);
    } else {
      const pmtNew = pmt(Bn, i, nFrac); // recomputed at the FRACTIONAL 2dp term
      updated = breakdown(Bn * i, pmtNew - Bn * i, roundHalfEven(nFrac, 0));
    }
  }

  // Differences of the ROUNDED display values (±0.01 artifacts are correct).
  const diff: InstallmentBreakdown = {
    interest: round2(updated.interest - current.interest),
    principal: round2(updated.principal - current.principal),
    installment: round2(updated.installment - current.installment),
    remaining: updated.remaining - current.remaining,
  };

  return { current, updated, diff };
}

export type FieldKey = 'capital' | 'installments' | 'rate' | 'amortization' | 'commission';
export type ErrorKey = 'required' | 'positive' | 'integer' | 'negative' | 'exceedsCapital';
export type FieldErrors = Partial<Record<FieldKey, ErrorKey>>;

export interface RawInput {
  capital: number | null;
  installments: number | null;
  annualRatePct: number | null;
  amortization: number | null;
  commissionRatePct: number | null;
}

export function validate(raw: RawInput): FieldErrors {
  const errors: FieldErrors = {};

  if (raw.capital === null) errors.capital = 'required';
  else if (raw.capital <= 0) errors.capital = 'positive';

  if (raw.installments === null) errors.installments = 'required';
  else if (raw.installments < 1) errors.installments = 'positive';
  else if (!Number.isInteger(raw.installments)) errors.installments = 'integer';

  if (raw.annualRatePct === null) errors.rate = 'required';
  else if (raw.annualRatePct < 0) errors.rate = 'negative';

  if (raw.amortization === null) errors.amortization = 'required';
  else if (raw.amortization <= 0) errors.amortization = 'positive';
  else if (raw.capital !== null && raw.capital > 0 && raw.amortization > raw.capital) {
    errors.amortization = 'exceedsCapital';
  }

  if (raw.commissionRatePct !== null && raw.commissionRatePct < 0) errors.commission = 'negative';

  return errors;
}
