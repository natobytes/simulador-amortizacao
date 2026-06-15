# Recurring Partial Repayments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick how often the partial repayment is made — once / yearly / every 2 years — and reflect the recurring repayments across the savings, chart, schedule, costs, and payoff term.

**Architecture:** Layer A (`simulate`, the twinkloo-exact "next installment" replica) is untouched. Layer B's scenario schedule becomes a recurring builder that injects a lump at the start of months 1, 1+interval, 1+2·interval, … For `once` (interval 0) only the month-1 lump fires, reproducing the previous single-lump schedule byte-for-byte. Cost is summed per repayment event. The frequency is an optional field on `SimulationInput` (defaults to `once`) so every existing call site and test vector is unchanged.

**Tech Stack:** Astro 6, React 19 island, TypeScript strict, Vitest. Engine in `src/lib/amortizacao.ts`.

**Spec:** `docs/superpowers/specs/2026-06-13-recurring-amortization-design.md` — read it first.

**File structure (what changes):**
- `src/lib/amortizacao.ts` — `Frequency` type, `frequencyInterval`, `SimulationInput.frequency`, `Schedule.amortizations/amortized`, `ScheduleRow.amortization`, `buildAmortizedSchedule`, rewired `buildSchedules`, `sumRepaymentCost`, recurring `computeSavings`.
- `src/lib/amortizacao.test.ts` — new vectors; all existing vectors stay green.
- `src/i18n/types.ts`, `src/i18n/pt.ts`, `src/i18n/en.ts` — new copy keys.
- `src/components/InputForm.tsx` — `FormState.frequency` + the dropdown.
- `src/components/Calculator.tsx` — default, parse, persistence (backward-compatible).
- `src/components/ScenarioPanel.tsx` — recurring wiring.
- `src/components/SummaryCards.tsx` — `caption` prop.
- `src/components/SavingsBanner.tsx` — recurring plan-summary line.
- `src/components/ScheduleTable.tsx` — per-event row marker.
- `src/styles/global.css` — three small style blocks.
- **`src/components/BalanceChart.tsx` — NO change needed** (scenario row balances already include the lumps, so the line shows the step-downs; the month-0 point stays `startBalance − amortization`).

**Conventions for all tasks:**
- Work in repo root `/Users/renato/Projects/Personal/simuladoramortizacao` on a feature branch `feat/recurring-amortization` (create it before Task 1: `git checkout -b feat/recurring-amortization`).
- End every commit message with the trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Test command: `npm test` (vitest run). Typecheck: `npm run check` (astro check). Build: `npm run build`.
- Run commands exactly as written; if output differs from "Expected", stop and investigate before proceeding.
- NEVER edit the existing V1–V9 expected values; they are live-verified.

---

### Task 1: Frequency type, interval mapping, and optional `SimulationInput.frequency`

**Files:**
- Modify: `src/lib/amortizacao.ts` (the `Strategy`/`SimulationInput` area, ~lines 38–49)
- Test: `src/lib/amortizacao.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/amortizacao.test.ts` (extend the top import to include `frequencyInterval` and `type Frequency`, then append this describe block after the `pmt` block):

```ts
describe('frequencyInterval', () => {
  it('maps frequencies to month intervals', () => {
    expect(frequencyInterval('once')).toBe(0);
    expect(frequencyInterval('yearly')).toBe(12);
    expect(frequencyInterval('biennial')).toBe(24);
  });
});
```

Update the import line at the top of the test file to:

```ts
import { roundHalfEven, round2, monthlyRate, pmt, simulate, type SimulationInput, type Frequency, frequencyInterval, validate, buildSchedule, buildSchedules, repaymentCost, sumRepaymentCost, computeSavings } from './amortizacao';
```

(`sumRepaymentCost` is imported now to avoid touching the import again in Task 3; it is unused until then, which is fine for a type-only import position but here it is a value — so add `sumRepaymentCost` only in Task 3. For THIS task, use this import line instead:)

```ts
import { roundHalfEven, round2, monthlyRate, pmt, simulate, type SimulationInput, type Frequency, frequencyInterval, validate, buildSchedule, buildSchedules, repaymentCost, computeSavings } from './amortizacao';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- amortizacao`
Expected: FAIL — `frequencyInterval is not a function` / `Frequency` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/amortizacao.ts`, replace the `Strategy` + `SimulationInput` block (currently lines ~38–49):

```ts
export type Strategy = 'reduceTerm' | 'reduceInstallment';

export type Frequency = 'once' | 'yearly' | 'biennial';

/** Months between repayment events. `once` => 0 (a single event at month 1). */
export function frequencyInterval(f: Frequency): number {
  switch (f) {
    case 'yearly':
      return 12;
    case 'biennial':
      return 24;
    default:
      return 0;
  }
}

export interface SimulationInput {
  /** Capital em dívida (EUR). */
  capital: number;
  /** Nº de prestações em falta (months). */
  installments: number;
  /** TAN = spread + Euribor, in percent (e.g. 3.5). */
  annualRatePct: number;
  /** Valor a amortizar (EUR), per repayment event. */
  amortization: number;
  /** How often the repayment is made. Absent => 'once' (single lump). */
  frequency?: Frequency;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- amortizacao`
Expected: PASS — `frequencyInterval` block green, all existing vectors still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat(engine): add Frequency type and optional SimulationInput.frequency

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Recurring scenario schedule builder

**Files:**
- Modify: `src/lib/amortizacao.ts` (`ScheduleRow`/`Schedule` ~154–167, `buildSchedule` ~171–196, `buildSchedules` ~203–218)
- Test: `src/lib/amortizacao.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/amortizacao.test.ts`:

```ts
describe('buildSchedules — recurring frequency', () => {
  it("once-frequency reduceTerm equals the single-lump schedule", () => {
    const i = monthlyRate(V1.annualRatePct);
    const ref = buildSchedule(V1.capital - V1.amortization, i, pmt(V1.capital, i, V1.installments));
    const { scenario } = buildSchedules({ ...V1, frequency: 'once' }, 'reduceTerm');
    expect(scenario.months).toBe(ref.months);
    expect(scenario.totalInterest).toBeCloseTo(ref.totalInterest, 6);
    expect(scenario.totalPaid).toBeCloseTo(ref.totalPaid, 6);
    expect(scenario.rows[0]!.payment).toBeCloseTo(ref.rows[0]!.payment, 6);
    expect(scenario.amortizations).toEqual([V1.amortization]);
    expect(scenario.amortized).toBe(V1.amortization);
  });

  it('once-frequency reduceInstallment equals the single-lump schedule', () => {
    const i = monthlyRate(V1.annualRatePct);
    const Bn = V1.capital - V1.amortization;
    const ref = buildSchedule(Bn, i, pmt(Bn, i, V1.installments));
    const { scenario } = buildSchedules({ ...V1, frequency: 'once' }, 'reduceInstallment');
    expect(scenario.months).toBe(ref.months);
    expect(scenario.rows[0]!.payment).toBeCloseTo(ref.rows[0]!.payment, 6);
  });

  it('yearly reduceTerm shortens the term and amortizes every 12 months', () => {
    const single = buildSchedules({ ...V1, frequency: 'once' }, 'reduceTerm').scenario;
    const yearly = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceTerm').scenario;
    expect(yearly.months).toBeLessThan(single.months);
    expect(yearly.totalInterest).toBeLessThan(single.totalInterest);
    expect(yearly.amortizations.length).toBeGreaterThan(1);
    const eventMonths = yearly.rows.filter((r) => r.amortization).map((r) => r.month);
    expect(eventMonths.slice(0, 3)).toEqual([1, 13, 25]);
    expect(yearly.amortized).toBeCloseTo(yearly.amortizations.reduce((a, b) => a + b, 0), 6);
  });

  it('yearly reduceInstallment keeps a long term and steps the installment down', () => {
    const yearlyInst = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceInstallment').scenario;
    const yearlyTerm = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceTerm').scenario;
    expect(yearlyInst.months).toBeLessThanOrEqual(360);
    expect(yearlyInst.months).toBeGreaterThan(yearlyTerm.months);
    const p1 = yearlyInst.rows[0]!.payment;
    const p13 = yearlyInst.rows.find((r) => r.month === 13)!.payment;
    expect(p13).toBeLessThan(p1);
  });

  it('biennial places events every 24 months (1, 25, 49)', () => {
    const s = buildSchedules({ ...V1, frequency: 'biennial' }, 'reduceTerm').scenario;
    const eventMonths = s.rows.filter((r) => r.amortization).map((r) => r.month);
    expect(eventMonths.slice(0, 3)).toEqual([1, 25, 49]);
  });

  it('a first lump that clears the loan still yields an empty schedule (months 0)', () => {
    const { scenario } = buildSchedules({ ...V1, amortization: 150000, frequency: 'yearly' }, 'reduceTerm');
    expect(scenario.months).toBe(0);
    expect(scenario.amortized).toBe(150000);
    expect(scenario.amortizations).toEqual([150000]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- amortizacao`
Expected: FAIL — `scenario.amortizations` undefined / no recurring behavior.

- [ ] **Step 3: Add the schedule fields**

In `src/lib/amortizacao.ts`, replace the `ScheduleRow` and `Schedule` interfaces (~154–167):

```ts
export interface ScheduleRow {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  balance: number;
  /** Extra repayment applied at the start of this month, when > 0 (display marker). */
  amortization?: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPaid: number;
  months: number;
  /** Per-event lump amounts in order (the final one may be capped). Empty when none. */
  amortizations: number[];
  /** Total of all lumps = sum(amortizations). */
  amortized: number;
}
```

- [ ] **Step 4: Update `buildSchedule`'s three returns**

In `buildSchedule` (~171–196), add `amortizations: [], amortized: 0` to every returned object. The final shape:

```ts
export function buildSchedule(startBalance: number, i: number, payment: number): Schedule {
  if (startBalance <= 0 || payment <= 0) return { rows: [], totalInterest: 0, totalPaid: 0, months: 0, amortizations: [], amortized: 0 };
  // Payment must exceed first-month interest or the balance never drains
  // (unreachable from validated input, but buildSchedule is a public export).
  if (i > 0 && payment <= startBalance * i) return { rows: [], totalInterest: 0, totalPaid: 0, months: 0, amortizations: [], amortized: 0 };
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
  return { rows, totalInterest, totalPaid, months: rows.length, amortizations: [], amortized: 0 };
}
```

- [ ] **Step 5: Add `buildAmortizedSchedule` and rewire `buildSchedules`**

Replace the existing `buildSchedules` function (~203–218) with the recurring builder plus the rewired public function:

```ts
/**
 * Scenario schedule supporting one or more partial repayments.
 *
 * A lump of `amortization` (capped at the remaining balance) is applied at the
 * START of months 1, 1+interval, 1+2*interval, ... When `interval` is 0 only the
 * month-1 lump fires (the single-lump case). Applying the first lump at month 1
 * reproduces buildSchedule(capital - amortization, i, payment) exactly, so the
 * 'once' path stays byte-identical to the previous engine.
 *
 * reduceTerm: the installment is fixed at pmt(capital, i, n); lumps shorten the term.
 * reduceInstallment: after each lump the installment is recomputed as
 *   pmt(balance, i, n - monthsElapsed) and steps down; the term stays ~n.
 */
function buildAmortizedSchedule(
  capital: number,
  i: number,
  n: number,
  strategy: Strategy,
  amortization: number,
  interval: number,
): Schedule {
  const empty: Schedule = { rows: [], totalInterest: 0, totalPaid: 0, months: 0, amortizations: [], amortized: 0 };
  if (capital <= 0 || amortization <= 0 || n <= 0) return empty;

  const rows: ScheduleRow[] = [];
  const amortizations: number[] = [];
  let balance = capital;
  let payment = pmt(capital, i, n); // reduceTerm uses this throughout; reduceInstallment recomputes
  let totalInterest = 0;
  let totalPaid = 0;
  let amortized = 0;
  let month = 0;

  while (balance > 0.005 && month < MAX_MONTHS) {
    month += 1;
    const isEvent = month === 1 || (interval > 0 && (month - 1) % interval === 0);
    let lump = 0;
    if (isEvent) {
      lump = Math.min(amortization, balance);
      balance -= lump;
      amortized += lump;
      amortizations.push(lump);
      if (balance <= 0.005) {
        // The lump itself cleared the loan. Record a final payoff row only when
        // installments preceded it (a mid-stream payoff); a month-1 clear leaves
        // an empty schedule, matching the previous full-payoff behaviour (months 0).
        if (rows.length > 0) {
          rows.push({ month, interest: 0, principal: 0, payment: 0, balance: 0, amortization: lump });
        }
        break;
      }
      if (strategy === 'reduceInstallment') {
        const remainingTerm = n - (month - 1);
        payment = remainingTerm > 0 ? pmt(balance, i, remainingTerm) : balance * (1 + i);
      }
    }
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
    rows.push({
      month,
      interest,
      principal,
      payment: paid,
      balance: Math.max(0, balance),
      ...(lump > 0 ? { amortization: lump } : {}),
    });
  }
  return { rows, totalInterest, totalPaid, months: rows.length, amortizations, amortized };
}

/** Precondition: `input` must have passed `validate()` with an empty error map; behaviour is undefined for invalid inputs. */
export function buildSchedules(input: SimulationInput, strategy: Strategy): SchedulePair {
  const i = monthlyRate(input.annualRatePct);
  const pmtOld = pmt(input.capital, i, input.installments);
  const baseline = buildSchedule(input.capital, i, pmtOld);
  const interval = frequencyInterval(input.frequency ?? 'once');
  const scenario = buildAmortizedSchedule(input.capital, i, input.installments, strategy, input.amortization, interval);
  return { baseline, scenario };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- amortizacao`
Expected: PASS — new recurring block green AND all existing `buildSchedule`/`buildSchedules`/`computeSavings`/`simulate` vectors still green (the `once` path is byte-identical).

- [ ] **Step 7: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat(engine): recurring scenario schedule with periodic repayments

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Per-event cost summation and recurring `computeSavings`

**Files:**
- Modify: `src/lib/amortizacao.ts` (`repaymentCost` area ~226–256)
- Test: `src/lib/amortizacao.test.ts`

- [ ] **Step 1: Write the failing tests**

First extend the import line at the top of `src/lib/amortizacao.test.ts` to add `sumRepaymentCost`:

```ts
import { roundHalfEven, round2, monthlyRate, pmt, simulate, type SimulationInput, type Frequency, frequencyInterval, validate, buildSchedule, buildSchedules, repaymentCost, sumRepaymentCost, computeSavings } from './amortizacao';
```

Append:

```ts
describe('sumRepaymentCost', () => {
  it('sums per-event commission and stamp duty', () => {
    expect(sumRepaymentCost([10000, 10000], 0.5)).toEqual({ commission: 100, stampDuty: 4, total: 104 });
  });
  it('matches single repaymentCost for one event', () => {
    expect(sumRepaymentCost([10000], 0.5)).toEqual(repaymentCost(10000, 0.5));
  });
  it('zero commission yields no cost', () => {
    expect(sumRepaymentCost([10000, 5000], 0)).toEqual({ commission: 0, stampDuty: 0, total: 0 });
  });
});

describe('computeSavings — recurring', () => {
  it('sums commission across every repayment event', () => {
    const { baseline, scenario } = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(scenario.amortizations.length).toBeGreaterThan(1);
    expect(s.cost.total).toBeGreaterThan(52); // more than a single 10 000 € event (52 €)
  });
  it('totalAfter = scenario installments + total amortized + total cost', () => {
    const { baseline, scenario } = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(s.totalAfter).toBe(round2(scenario.totalPaid + scenario.amortized + s.cost.total));
  });
  it('recurring saves more interest than a single lump', () => {
    const oncePair = buildSchedules({ ...V1, frequency: 'once' }, 'reduceTerm');
    const onceSaved = computeSavings(oncePair.baseline, oncePair.scenario, V1.amortization, 0.5).interestSaved;
    const yearlyPair = buildSchedules({ ...V1, frequency: 'yearly' }, 'reduceTerm');
    const yearlySaved = computeSavings(yearlyPair.baseline, yearlyPair.scenario, V1.amortization, 0.5).interestSaved;
    expect(yearlySaved).toBeGreaterThan(onceSaved);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- amortizacao`
Expected: FAIL — `sumRepaymentCost is not a function`; recurring `cost.total` still equals 52 (single-event) until `computeSavings` is updated.

- [ ] **Step 3: Add `sumRepaymentCost` and rewire `computeSavings`**

In `src/lib/amortizacao.ts`, keep `repaymentCost` exactly as-is. Add `sumRepaymentCost` right after it, and replace `computeSavings`:

```ts
/** Total early-repayment cost across several events (each rounded as the bank bills it). */
export function sumRepaymentCost(amounts: number[], commissionRatePct: number): CostBreakdown {
  let commission = 0;
  let stampDuty = 0;
  for (const amount of amounts) {
    const c = repaymentCost(amount, commissionRatePct);
    commission = round2(commission + c.commission);
    stampDuty = round2(stampDuty + c.stampDuty);
  }
  return { commission, stampDuty, total: round2(commission + stampDuty) };
}

export function computeSavings(
  baseline: Schedule,
  scenario: Schedule,
  amortization: number,
  commissionRatePct: number,
): SavingsSummary {
  const interestSaved = round2(baseline.totalInterest - scenario.totalInterest);
  // The scenario carries the actual per-event lump amounts (final one capped).
  // Fall back to the single `amortization` arg if a caller passes a bare schedule.
  const events = scenario.amortizations.length > 0 ? scenario.amortizations : [amortization];
  const amortizedTotal = scenario.amortizations.length > 0 ? scenario.amortized : amortization;
  const cost = sumRepaymentCost(events, commissionRatePct);
  // Both totals fully repay the capital, so totalBefore − totalAfter ≈ netSavings
  // (within a cent or two of independent-rounding artifacts, which are correct).
  const totalBefore = round2(baseline.totalPaid);
  const totalAfter = round2(scenario.totalPaid + amortizedTotal + cost.total);
  return { interestSaved, cost, netSavings: round2(interestSaved - cost.total), totalBefore, totalAfter };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new `sumRepaymentCost` and recurring `computeSavings` blocks green; ALL existing `computeSavings` vectors (242484.13 / 225593.76 / 280257.45 / 316702.1 / zero-commission / full-payoff) still green because `once` produces a single event equal to the old single-lump cost.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat(engine): sum early-repayment cost per event

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: i18n copy for the frequency selector and recurring outputs

**Files:**
- Modify: `src/i18n/types.ts`, `src/i18n/pt.ts`, `src/i18n/en.ts`

- [ ] **Step 1: Extend the `Dict` type**

In `src/i18n/types.ts`, update the `form`, `cards`, `banner`, and `table` members:

In `form`, after `commissionOptions: {...};` add:
```ts
    frequency: string;
    frequencyOptions: { once: string; yearly: string; biennial: string };
```

In `cards`, after `caption: string;` add:
```ts
    captionRecurring: string;
```

In `banner`, after `fullPayoff: string;` add:
```ts
    repayments: string;
```

In `table`, change the line to include the marker key:
```ts
  table: { show: string; hide: string; month: string; interest: string; principal: string; payment: string; balance: string; total: string; amortizationNote: string };
```

- [ ] **Step 2: Add the PT copy**

In `src/i18n/pt.ts`:

In `form`, after the `commissionOptions: { ... }` object and `customRate`, add:
```ts
    frequency: 'Frequência da amortização',
    frequencyOptions: {
      once: 'Uma vez',
      yearly: 'Anual',
      biennial: 'A cada 2 anos',
    },
```

In `cards`, after `caption: 'Valores da próxima prestação mensal.',` add:
```ts
    captionRecurring: 'Valores da próxima prestação, após a primeira amortização.',
```

In `banner`, after `fullPayoff: '...',` add:
```ts
    repayments: '{count} amortizações de {amount} (total {total})',
```

In `table`, after `total: 'Total',` add:
```ts
    amortizationNote: '+{amount} amortizado',
```

- [ ] **Step 3: Add the EN copy**

In `src/i18n/en.ts`:

In `form`, after `commissionOptions` and `customRate`, add:
```ts
    frequency: 'Repayment frequency',
    frequencyOptions: {
      once: 'Once',
      yearly: 'Yearly',
      biennial: 'Every 2 years',
    },
```

In `cards`, after `caption: 'Breakdown of the next monthly installment.',` add:
```ts
    captionRecurring: 'Next installment values, after the first repayment.',
```

In `banner`, after `fullPayoff: '...',` add:
```ts
    repayments: '{count} repayments of {amount} ({total} total)',
```

In `table`, after `total: 'Total',` add:
```ts
    amortizationNote: '+{amount} repaid',
```

- [ ] **Step 4: Verify typecheck + i18n tests**

Run: `npm run check && npm test -- i18n`
Expected: PASS — both locales satisfy `Dict`; the "no empty strings" test still passes.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/pt.ts src/i18n/en.ts
git commit -m "feat(i18n): copy for repayment frequency and recurring outputs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Form state, parsing, and backward-compatible persistence

**Files:**
- Modify: `src/components/InputForm.tsx` (`FormState` ~6–15)
- Modify: `src/components/Calculator.tsx` (`emptyForm` ~17–26, `isStoredForm` ~45–57, `parseForm` ~65–121, save effect ~142–159, restore effect ~164–201)

- [ ] **Step 1: Add `frequency` to `FormState`**

In `src/components/InputForm.tsx`, add the import and the field. At the top imports, change:
```ts
import { formatInputValue, groupAsTyped, type Locale } from '../lib/format';
```
to also import the type:
```ts
import type { Frequency } from '../lib/amortizacao';
import { formatInputValue, groupAsTyped, type Locale } from '../lib/format';
```

Update `FormState`:
```ts
export interface FormState {
  capital: string;
  installments: string;
  rate: string;
  amortization: string;
  frequency: Frequency;
  commissionPreset: CommissionPreset;
  customCommission: string;
}
```

- [ ] **Step 2: Default it in `emptyForm`**

In `src/components/Calculator.tsx`, update `emptyForm`:
```ts
function emptyForm(): FormState {
  return {
    capital: '',
    installments: '',
    rate: '',
    amortization: '',
    frequency: 'once',
    commissionPreset: 'none',
    customCommission: '',
  };
}
```

- [ ] **Step 3: Make `isStoredForm` backward-compatible**

In `src/components/Calculator.tsx`, replace `isStoredForm` so it validates the six original string fields and tolerates a missing/added `frequency` (older v1 entries predate it). Note the narrowed return type:
```ts
/**
 * Shape-check a value read back from localStorage. The six original FormState
 * fields must be strings and commissionPreset a known preset. `frequency` was
 * added later, so it is NOT required here (v1 entries written before this feature
 * lack it) — the restore step defaults it. Anything else is ignored.
 */
function isStoredForm(value: unknown): value is Omit<FormState, 'frequency'> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.capital === 'string' &&
    typeof v.installments === 'string' &&
    typeof v.rate === 'string' &&
    typeof v.amortization === 'string' &&
    typeof v.customCommission === 'string' &&
    typeof v.commissionPreset === 'string' &&
    COMMISSION_PRESET_VALUES.includes(v.commissionPreset)
  );
}
```

- [ ] **Step 4: Pass `frequency` through `parseForm`**

In `src/components/Calculator.tsx`, in `parseForm`, update the returned `input` object so the valid branch includes `frequency`:
```ts
    input: valid
      ? {
          capital: raw.capital!,
          installments: raw.installments!,
          annualRatePct: raw.annualRatePct!,
          amortization: raw.amortization!,
          frequency: form.frequency,
        }
      : null,
```

- [ ] **Step 5: Persist and restore `frequency`**

In the save effect, add `frequency` to the stored object:
```ts
        JSON.stringify({
          capital: debounced.capital,
          installments: debounced.installments,
          rate: debounced.rate,
          amortization: debounced.amortization,
          frequency: debounced.frequency,
          commissionPreset: debounced.commissionPreset,
          customCommission: debounced.customCommission,
        }),
```

In the restore effect, inside `if (isStoredForm(stored)) {`, build `restored` with a defaulted frequency:
```ts
          const storedFreq = (stored as { frequency?: unknown }).frequency;
          const frequency: Frequency =
            storedFreq === 'yearly' || storedFreq === 'biennial' ? storedFreq : 'once';
          const restored: FormState = {
            capital: formatInputValue(stored.capital, locale),
            installments: formatInputValue(stored.installments, locale),
            rate: formatInputValue(stored.rate, locale),
            amortization: formatInputValue(stored.amortization, locale),
            frequency,
            commissionPreset: stored.commissionPreset,
            customCommission: formatInputValue(stored.customCommission, locale),
          };
```

Add the `Frequency` import to Calculator's existing amortizacao import. Change:
```ts
import { validate } from '../lib/amortizacao';
```
to:
```ts
import type { Frequency } from '../lib/amortizacao';
import { validate } from '../lib/amortizacao';
```

- [ ] **Step 6: Verify typecheck + tests**

Run: `npm run check && npm test`
Expected: PASS — typecheck clean, all engine/i18n tests green.

- [ ] **Step 7: Commit**

```bash
git add src/components/InputForm.tsx src/components/Calculator.tsx
git commit -m "feat(form): thread repayment frequency through state and storage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Frequency dropdown in the input form

**Files:**
- Modify: `src/components/InputForm.tsx` (the form body, between the `{fields.map(...)}` block and the commission `<div className="field">`)

- [ ] **Step 1: Add the dropdown markup**

In `src/components/InputForm.tsx`, immediately AFTER the closing `})}` of the `{fields.map((f) => { ... })}` block and BEFORE `<div className="field">` that holds the commission `<label htmlFor="commission">`, insert:

```tsx
        <div className="field">
          <label htmlFor="frequency">{dict.form.frequency}</label>
          <select
            id="frequency"
            data-testid="input-frequency"
            value={form.frequency}
            onChange={(e) => set({ frequency: e.target.value as Frequency })}
          >
            <option value="once">{dict.form.frequencyOptions.once}</option>
            <option value="yearly">{dict.form.frequencyOptions.yearly}</option>
            <option value="biennial">{dict.form.frequencyOptions.biennial}</option>
          </select>
        </div>
```

(`Frequency` is already imported from Task 5; `set` already exists. The `.form-grid .field:has(select)` rule makes this row span both columns, matching the commission select.)

- [ ] **Step 2: Verify typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS — build succeeds for both `/` and `/en/`.

- [ ] **Step 3: Commit**

```bash
git add src/components/InputForm.tsx
git commit -m "feat(form): add repayment-frequency dropdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Summary cards term override + savings banner recurring line

These three components share a prop contract, so they change together.

**Files:**
- Modify: `src/components/SummaryCards.tsx` (Props ~6–10, caption render ~35)
- Modify: `src/components/SavingsBanner.tsx` (Props ~6–11, body ~13–25)
- Modify: `src/components/ScenarioPanel.tsx` (~19–53)

- [ ] **Step 1: Give `SummaryCards` a `caption` prop**

In `src/components/SummaryCards.tsx`, update Props and the caption line:
```ts
interface Props {
  result: ScenarioResult;
  caption: string;
  dict: Dict;
  locale: Locale;
}
```
Change the function signature to `export default function SummaryCards({ result, caption, dict, locale }: Props) {` and replace:
```tsx
        <p className="summary-caption">{dict.cards.caption}</p>
```
with:
```tsx
        <p className="summary-caption">{caption}</p>
```

- [ ] **Step 2: Add the recurring line to `SavingsBanner`**

In `src/components/SavingsBanner.tsx`, update the imports and Props, and insert the line. Change the import block top to add `tpl`:
```ts
import type { Dict } from '../i18n';
import { tpl } from '../i18n';
import type { SavingsSummary } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro } from '../lib/format';
```
Update Props:
```ts
interface Props {
  savings: SavingsSummary;
  fullPayoff: boolean;
  repaymentCount: number;
  amortizedTotal: number;
  perEvent: number;
  dict: Dict;
  locale: Locale;
}
```
Update the signature to `export default function SavingsBanner({ savings, fullPayoff, repaymentCount, amortizedTotal, perEvent, dict, locale }: Props) {` and, immediately AFTER the `{fullPayoff && <p className="savings-payoff">{dict.banner.fullPayoff}</p>}` line, insert:
```tsx
      {repaymentCount > 1 && (
        <p className="savings-repayments" data-testid="savings-repayments">
          {tpl(dict.banner.repayments, {
            count: String(repaymentCount),
            amount: formatEuro(perEvent, locale),
            total: formatEuro(amortizedTotal, locale),
          })}
        </p>
      )}
```

- [ ] **Step 3: Wire `ScenarioPanel`**

In `src/components/ScenarioPanel.tsx`, replace the body of the component (the `result`/`baseline`/`savings`/`meta` setup and the two child elements) so it computes the recurring overrides and passes the new props. Full replacement for the function body:

```tsx
export default function ScenarioPanel({ strategy, input, commissionRatePct, dict, locale }: Props) {
  const result = useMemo(() => simulate(input, strategy), [input, strategy]);
  const { baseline, scenario } = useMemo(() => buildSchedules(input, strategy), [input, strategy]);
  const savings = useMemo(
    () => computeSavings(baseline, scenario, input.amortization, commissionRatePct),
    [baseline, scenario, input.amortization, commissionRatePct],
  );
  const meta = dict.scenarios[strategy];

  const recurring = (input.frequency ?? 'once') !== 'once';
  // Under a recurring plan the cards' remaining-installments row should reflect
  // the REAL recurring payoff term (the schedule), not simulate()'s single-event
  // term. The money rows keep the simulate() snapshot (next installment after the
  // first repayment).
  const cardResult = useMemo(() => {
    if (!recurring) return result;
    return {
      current: result.current,
      updated: { ...result.updated, remaining: scenario.months },
      diff: { ...result.diff, remaining: scenario.months - input.installments },
    };
  }, [recurring, result, scenario.months, input.installments]);
  const caption = recurring ? dict.cards.captionRecurring : dict.cards.caption;

  return (
    <article className="scenario" data-testid={`scenario-${strategy}`}>
      <header className="scenario-header">
        <span className="scenario-index" aria-hidden="true">
          {strategy === 'reduceTerm' ? '01' : '02'}
        </span>
        <h2>{meta.title}</h2>
        <p>{meta.subtitle}</p>
      </header>
      {/* Recalculation announcements come from the persistent aria-live region
          in Calculator.tsx, which wraps both panels; no aria-live here so
          regions don't nest and double-announce. */}
      <div className="scenario-results">
        <SavingsBanner
          savings={savings}
          fullPayoff={result.updated.remaining === 0}
          repaymentCount={scenario.amortizations.length}
          amortizedTotal={scenario.amortized}
          perEvent={input.amortization}
          dict={dict}
          locale={locale}
        />
        <SummaryCards result={cardResult} caption={caption} dict={dict} locale={locale} />
        <BalanceChart
          baseline={baseline}
          scenario={scenario}
          startBalance={input.capital}
          amortization={input.amortization}
          dict={dict}
          locale={locale}
        />
        <ScheduleTable schedule={scenario} dict={dict} locale={locale} />
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Verify typecheck + build + tests**

Run: `npm run check && npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SummaryCards.tsx src/components/SavingsBanner.tsx src/components/ScenarioPanel.tsx
git commit -m "feat(ui): recurring payoff term in cards and plan summary in banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Mark amortization months in the schedule table

**Files:**
- Modify: `src/components/ScheduleTable.tsx` (imports ~1–5, tbody rows ~41–49)

- [ ] **Step 1: Import `tpl`**

In `src/components/ScheduleTable.tsx`, change:
```ts
import type { Dict } from '../i18n';
```
to:
```ts
import type { Dict } from '../i18n';
import { tpl } from '../i18n';
```

- [ ] **Step 2: Mark event rows**

Replace the `{schedule.rows.map((r) => ( ... ))}` block with:
```tsx
              {schedule.rows.map((r) => (
                <tr key={r.month} className={r.amortization ? 'schedule-row--amortization' : undefined}>
                  <td>{r.month}</td>
                  <td>{formatEuro(r.payment, locale)}</td>
                  <td>{formatEuro(r.interest, locale)}</td>
                  <td>{formatEuro(r.principal, locale)}</td>
                  <td>
                    {formatEuro(r.balance, locale)}
                    {r.amortization ? (
                      <small className="amortization-note">
                        {' '}
                        {tpl(dict.table.amortizationNote, { amount: formatEuro(r.amortization, locale) })}
                      </small>
                    ) : null}
                  </td>
                </tr>
              ))}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScheduleTable.tsx
git commit -m "feat(ui): mark extra-repayment months in the schedule table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Styles for the recurring outputs

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the savings-banner repayments style**

In `src/styles/global.css`, immediately AFTER the `.savings-payoff { ... }` rule (ends ~line 473), insert:
```css
.savings-repayments {
  margin-top: 0.6rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  background: rgb(246 240 228 / 0.12);
  font-size: 0.88rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--cream) 88%, var(--pine));
}
```

- [ ] **Step 2: Add the schedule amortization-row styles**

Immediately AFTER the `.schedule-table tbody tr:nth-child(even) { ... }` rule (ends ~line 877), insert:
```css
.schedule-table tbody tr.schedule-row--amortization td {
  background: color-mix(in srgb, var(--mint) 24%, transparent);
}

.amortization-note {
  color: var(--pine);
  font-weight: 700;
  font-size: 0.78em;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "style: recurring repayment summary and schedule markers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites, including V1–V9 and the new recurring vectors.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes; `/` and `/en/` both emitted.

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Run: `npm run dev`, open the local URL, and confirm: choosing "Anual"/"Yearly" shortens the payoff in the reduceTerm panel, the banner shows the "N amortizações…" line, and the schedule table marks the yearly rows. Stop the dev server when done.

- [ ] **Step 5: Confirm a clean tree**

Run: `git status`
Expected: clean (everything committed across Tasks 1–9).

---

## Self-Review notes

- **Spec coverage:** §3.1 (simulate untouched) — no task modifies `simulate`. §3.2/§3.3 — Tasks 1–2. §3.4 (additive Schedule fields, totalPaid installments-only) — Task 2. §3.5 (per-event cost) — Task 3. §4 (form/state/persistence) — Tasks 5–6. §5 (cards term override, banner line, chart no-op, table marker) — Tasks 7–9. §6 (i18n) — Task 4. §7 (tests) — Tasks 1–3.
- **`once` equivalence:** guaranteed by applying the first lump at month 1 and asserted in Task 2 against a reference `buildSchedule`; every pre-existing vector stays green without edits.
- **Type consistency:** `Frequency`, `frequencyInterval`, `sumRepaymentCost`, `Schedule.amortizations/amortized`, `ScheduleRow.amortization`, `FormState.frequency`, and the `SummaryCards.caption` / `SavingsBanner.{repaymentCount,amortizedTotal,perEvent}` props are defined before they are consumed.
</content>
