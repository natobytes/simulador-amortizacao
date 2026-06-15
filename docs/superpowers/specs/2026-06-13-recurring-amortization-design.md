# Recurring Partial Repayments — Design Spec

**Date:** 2026-06-13
**Repo:** `natobytes/simulador-amortizacao` (public)
**Builds on:** `docs/superpowers/specs/2026-06-10-simulador-amortizacao-design.md` (read first — it defines Layer A/B, the .NET rounding model, and the sacred test vectors V1–V9)

## 1. Goal

Let the user choose **how often** the partial repayment ("Valor a Amortizar") is made,
instead of assuming a single one-off lump. A new frequency selector offers:

| Value | PT label | EN label | Interval |
|---|---|---|---|
| `once` | Uma vez | Once | single lump (today's behavior) |
| `yearly` | Anual | Yearly | every 12 months |
| `biennial` | A cada 2 anos | Every 2 years | every 24 months |

The same euro amount is repaid each period. Every downstream output (savings, balance
chart, schedule table, costs, and the recurring payoff term) reflects all the repayments.

**Non-goals:** no change to the twinkloo-exact Layer A math; no new field validation beyond
the fixed option set; no monthly/semi-annual options (deferred — YAGNI).

## 2. Decisions (locked with the user)

1. **Frequencies offered:** `once` / `yearly` / `biennial` only.
2. **Timing:** the first repayment is applied at the **start of month 1** (exactly where
   today's single lump is applied), then repeats every interval — i.e. lumps fire at the
   start of months **1, 1+interval, 1+2·interval, …**. `once` is the degenerate case (only
   the month-1 lump), so it stays **byte-identical** to today.
3. **Cost:** the early-repayment commission + 4 % stamp duty is charged on **every** repayment
   event (legally accurate), summed across events; the final (capped) event included.
4. **SummaryCards "Nº de Prestações em Falta" under a recurring plan:** show the **real
   recurring payoff term** (from the full schedule), so the cards' term matches the chart and
   banner. The money rows (Juros / Capital / Prestação) still show the next installment after
   the *first* repayment (the unchanged `simulate()` snapshot).

## 3. Engine changes — `src/lib/amortizacao.ts`

### 3.1 Layer A (`simulate`) — UNCHANGED

`simulate()` continues to model the immediate effect of **one** repayment on the next
installment. Frequency never enters Layer A. V1–V9 stay exact.

### 3.2 New frequency type + interval mapping

```ts
export type Frequency = 'once' | 'yearly' | 'biennial';
/** Months between repayment events; `once` => no repeats (single event). */
export function frequencyInterval(f: Frequency): number; // once->0, yearly->12, biennial->24
```

`SimulationInput` gains an **optional** `frequency?: Frequency` (defaults to `'once'` when
absent), so all existing call sites and test vectors compile and behave unchanged.

### 3.3 Recurring scenario schedule

A scenario builder applies a lump of `amortization` (capped at remaining balance) at the
start of months `1, 1+interval, 1+2·interval, …` (for `once`, only month 1):

- `reduceTerm`: installment fixed at `pmt(capital, i, n)`; lumps accelerate payoff (term shrinks).
- `reduceInstallment`: after each lump the payment is recomputed as
  `pmt(balance, i, n − monthsElapsed)` — installments step **down** over time, term ≈ n
  (or earlier if lumps exhaust the balance).
- A lump is applied **before** that month's interest accrues (matches today: month-1 interest
  is on `capital − A`). Once balance reaches 0, no further events fire.

**Equivalence guarantee:** for `frequency = 'once'` the builder reproduces
`buildSchedule(capital − A, i, payment)` exactly (verified by the existing `buildSchedules`
tests: reduceTerm 320–321 months, reduceInstallment 360, first-payment values).

### 3.4 Schedule shape — additive fields only

`Schedule` gains:
- `amortized: number` — total of all lump events (0 for baseline / non-amortizing schedules).

`ScheduleRow` gains:
- `amortization?: number` — the lump applied at the start of that month, when > 0 (for the table marker).

`scenario.totalPaid` stays **installments-only** (lumps tracked separately in `amortized`).
This is what preserves the `computeSavings` totals math for `once`
(`totalAfter = scenario.totalPaid + amortized + cost.total`).

Existing tests use field-level assertions (`toBe`/`toBeCloseTo`/`toBeGreaterThan`) on
`Schedule`, never whole-object `toEqual`, so the additive fields break nothing.

### 3.5 Cost — per event

`repaymentCost(amount, rate)` is **unchanged** (its `toEqual` tests stay green). Cost
summation moves into `computeSavings`, which iterates the scenario's per-event lump amounts
(derivable from rows where `amortization > 0`) and sums `repaymentCost` over them. For
`once` this is a single event → identical `52` / `208` / `0` results.

`computeSavings` keeps its current signature `(baseline, scenario, amortization, commissionRatePct)`;
internally it uses the scenario's events for cost and `scenario.amortized` for `totalAfter`.
For `once`, `scenario.amortized === amortization`, so every pinned `computeSavings` value
(`242484.13`, `225593.76`, `280257.45`, `316702.1`, the ≤0.02 reconciliation, the zero-commission
case) is preserved.

## 4. Form & state — `Calculator.tsx`, `InputForm.tsx`

- New `frequency` dropdown styled like the existing commission `<select>`, placed directly
  under "Valor a Amortizar".
- `FormState` gains `frequency: Frequency`. `emptyForm()` defaults it to `'once'`. `parseForm`
  passes it into `SimulationInput`.
- **localStorage stays key `:v1`, backward-compatible:** `isStoredForm` accepts a stored form
  whose `frequency` is missing or a valid `Frequency`; restore coerces a missing/invalid value
  to `'once'`. Existing users keep their saved inputs.
- No new validation: the option set is fixed, and the per-event amount keeps the existing
  `> 0, ≤ capital` rule (a recurring sum exceeding capital is fine — the loan simply pays off
  early and the final event is capped).

## 5. Output components

- **SummaryCards** (`ScenarioPanel.tsx` + `SummaryCards.tsx`): money rows stay the exact
  `simulate()` snapshot. When `frequency !== 'once'`, `ScenarioPanel` overrides the cards'
  `updated.remaining` with the recurring schedule term (`scenario.months`) and
  `diff.remaining` with `scenario.months − n`; `current.remaining` stays `n`. The caption
  gains a recurring variant clarifying the money rows describe the first repayment.
- **SavingsBanner**: when recurring, add a plan-summary line —
  *"{count} amortizações de {amount} (total {total})"* — using the event count and
  `scenario.amortized`. Headline, cost breakdown, and totals formulas are unchanged (cost is
  now the per-event sum; interest saved is naturally larger).
- **BalanceChart**: no logic change — the scenario row balances already include the lumps, so
  the line shows the step-downs. The month-0 point stays `startBalance − firstLump`.
- **ScheduleTable**: rows with `amortization > 0` are visually marked with the extra amount
  (row class + a small note); numeric columns and the footer totals remain installments-only.

## 6. i18n — `types.ts`, `pt.ts`, `en.ts`

New keys (PT informal tu-form; EN parallel):
- `form.frequency` (label) + `form.frequencyOptions.{once,yearly,biennial}`.
- `banner.repayments` — template with `{count}`, `{amount}`, `{total}`.
- `cards.captionRecurring` — recurring variant of the next-installment caption.

`Dict` in `types.ts` is extended to match; both locales kept in sync.

## 7. Testing — `amortizacao.test.ts` (+ existing suites stay green)

New vectors / assertions:
- **once-equivalence:** recurring builder with `frequency: 'once'` equals today's
  `buildSchedules` output (term + first-payment value) for V1 both strategies.
- **yearly reduceTerm:** term strictly shorter than the single-lump term; `amortized` equals
  `events × amount` (final capped); `totalInterest` lower than single-lump.
- **yearly reduceInstallment:** term ≈ n; installment steps down across event months.
- **biennial:** events at months 1, 25, 49, … (interval honored).
- **cost summation:** N events → `cost.total ≈ N × per-event cost` (within rounding); `once`
  unchanged.
- **`computeSavings` recurring:** `totalAfter = scenario.totalPaid + amortized + cost.total`;
  `interestSaved` larger than single-lump.

## 8. Out of scope / follow-ups

- Monthly or semi-annual frequencies.
- Per-event variable amounts (e.g. an annual bonus that grows).
- FAQ copy update mentioning recurring repayments (optional, can follow).
