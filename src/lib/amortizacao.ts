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
  const frac = scaled - floor;
  const EPS = 1e-9;
  let result: number;
  if (Math.abs(frac - 0.5) < EPS) {
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

/** Precondition: `input` must have passed `validate()` with an empty error map; behaviour is undefined for invalid inputs. */
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
export type ErrorKey = 'required' | 'positive' | 'integer' | 'negative' | 'exceedsCapital' | 'invalid';
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

// ---------------------------------------------------------------------------
// Layer B — full-precision month-by-month schedule. Powers the savings banner,
// the balance chart and the amortization table. Display layers round; the
// schedule itself never does.
// ---------------------------------------------------------------------------

export interface ScheduleRow {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  balance: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPaid: number;
  months: number;
}

const MAX_MONTHS = 1200;

export function buildSchedule(startBalance: number, i: number, payment: number): Schedule {
  if (startBalance <= 0 || payment <= 0) return { rows: [], totalInterest: 0, totalPaid: 0, months: 0 };
  // Payment must exceed first-month interest or the balance never drains
  // (unreachable from validated input, but buildSchedule is a public export).
  if (i > 0 && payment <= startBalance * i) return { rows: [], totalInterest: 0, totalPaid: 0, months: 0 };
  const rows: ScheduleRow[] = [];
  let balance = startBalance;
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  while (balance > 0.005 && month < MAX_MONTHS) {
    month += 1;
    const interest = balance * i;
    let principal = payment - interest;
    let paid = payment;
    if (principal >= balance - 0.005 || month === MAX_MONTHS) {
      principal = balance; // final installment clears the residual exactly
      paid = balance + interest;
    }
    balance -= principal;
    totalInterest += interest;
    totalPaid += paid;
    rows.push({ month, interest, principal, payment: paid, balance: Math.max(0, balance) });
  }
  return { rows, totalInterest, totalPaid, months: rows.length };
}

export interface SchedulePair {
  baseline: Schedule;
  scenario: Schedule;
}

/** Precondition: `input` must have passed `validate()` with an empty error map; behaviour is undefined for invalid inputs. */
export function buildSchedules(input: SimulationInput, strategy: Strategy): SchedulePair {
  const i = monthlyRate(input.annualRatePct);
  const pmtOld = pmt(input.capital, i, input.installments);
  const baseline = buildSchedule(input.capital, i, pmtOld);
  const Bn = input.capital - input.amortization;
  let scenario: Schedule;
  if (Bn <= 0) {
    scenario = { rows: [], totalInterest: 0, totalPaid: 0, months: 0 };
  } else if (strategy === 'reduceTerm') {
    scenario = buildSchedule(Bn, i, pmtOld);
  } else {
    scenario = buildSchedule(Bn, i, pmt(Bn, i, input.installments));
  }
  return { baseline, scenario };
}

export interface CostBreakdown {
  commission: number;
  stampDuty: number;
  total: number;
}

/** Commission on the amount repaid + 4% stamp duty (verba 17.3.4) on the commission. */
export function repaymentCost(amortization: number, commissionRatePct: number): CostBreakdown {
  const commission = round2(amortization * (commissionRatePct / 100));
  const stampDuty = commission > 0 ? round2(commission * 0.04) : 0;
  return { commission, stampDuty, total: round2(commission + stampDuty) };
}

export interface SavingsSummary {
  interestSaved: number;
  cost: CostBreakdown;
  netSavings: number;
}

export function computeSavings(
  baseline: Schedule,
  scenario: Schedule,
  amortization: number,
  commissionRatePct: number,
): SavingsSummary {
  const interestSaved = round2(baseline.totalInterest - scenario.totalInterest);
  const cost = repaymentCost(amortization, commissionRatePct);
  return { interestSaved, cost, netSavings: round2(interestSaved - cost.total) };
}
