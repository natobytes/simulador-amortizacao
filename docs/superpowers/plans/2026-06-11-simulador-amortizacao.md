# Simulador de Amortização Antecipada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a client-only, bilingual (PT default + EN) early-mortgage-repayment calculator at `https://natobytes.github.io/simulador-amortizacao/` that replicates twinkloo.pt's results cent-for-cent and shows both strategies (reduce term / reduce installment) side by side.

**Architecture:** Astro 6 static site with one React island (`client:load`) for the calculator. A pure-TS engine (`src/lib/amortizacao.ts`) has two layers: Layer A replicates Twinkloo's exact .NET rounding model (summary cards); Layer B is a full-precision month-by-month schedule (savings banner, SVG chart, amortization table). i18n via Astro built-in routing: PT at `/`, EN at `/en/`.

**Tech Stack:** Astro 6, @astrojs/react (React 19), @astrojs/sitemap, TypeScript strict, Vitest, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-06-10-simulador-amortizacao-design.md` — read it first; it contains the verified calculation model and the test vectors V1–V9 referenced below.

**Conventions for all tasks:**
- Work in repo root `/Users/renato/Projects/Personal/simuladoramortizacao`.
- Append the standard `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer to every commit.
- Run commands exactly as written; if output differs from "Expected", stop and investigate before proceeding.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/pages/index.astro` (placeholder)

- [ ] **Step 1: Write `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
.DS_Store
npm-debug.log*
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "simulador-amortizacao",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install astro @astrojs/react @astrojs/sitemap react react-dom
npm install -D typescript @astrojs/check vitest @types/react @types/react-dom
```
Expected: lockfile created, no errors. (Astro major version should be 6.x — check with `npx astro --version`.)

- [ ] **Step 4: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://natobytes.github.io',
  base: '/simulador-amortizacao',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'pt',
    locales: ['pt', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // sitemap() intentionally has NO i18n option: the HTML <link> hreflang tags in
  // Base.astro are the single source of hreflang truth (spec §6). Do not "fix" this.
  integrations: [react(), sitemap()],
});
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*", ".astro/types.d.ts"],
  "exclude": ["dist"]
}
```

- [ ] **Step 6: Write placeholder `src/pages/index.astro`**

```astro
---
---
<!doctype html>
<html lang="pt-PT">
  <head><meta charset="utf-8" /><title>Simulador de Amortização Antecipada</title></head>
  <body><h1>Em construção</h1></body>
</html>
```

- [ ] **Step 7: Verify the build works**

Run: `npm run build`
Expected: build succeeds; `dist/index.html` exists; sitemap files `dist/sitemap-index.xml` and `dist/sitemap-0.xml` exist.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro 6 project with react, sitemap, i18n and GitHub Pages config"
```

---

### Task 2: Rounding helpers and `pmt` (Layer A foundations)

**Files:**
- Create: `src/lib/amortizacao.ts`
- Test: `src/lib/amortizacao.test.ts`

- [ ] **Step 1: Write the failing tests (vector V9 + pmt)**

Create `src/lib/amortizacao.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/amortizacao.test.ts`
Expected: FAIL — `Cannot find module './amortizacao'` (or missing exports).

- [ ] **Step 3: Implement the helpers**

Create `src/lib/amortizacao.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/amortizacao.test.ts`
Expected: PASS (4 + 3 = 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat: half-to-even rounding and pmt helpers with V9 vectors"
```

---

### Task 3: Layer A — Twinkloo-exact `simulate()`

**Files:**
- Modify: `src/lib/amortizacao.ts` (append)
- Test: `src/lib/amortizacao.test.ts` (append)

- [ ] **Step 1: Append the failing tests (vectors V1–V8)**

Append to `src/lib/amortizacao.test.ts`:

```ts
import { simulate, type SimulationInput } from './amortizacao';

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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/amortizacao.test.ts`
Expected: FAIL — `simulate` is not exported.

- [ ] **Step 3: Implement `simulate()`**

Append to `src/lib/amortizacao.ts`:

```ts
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
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — all Task 2 + Task 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat: Twinkloo-exact simulate() for both strategies (vectors V1-V8)"
```

---

### Task 4: Input validation

**Files:**
- Modify: `src/lib/amortizacao.ts` (append)
- Test: `src/lib/amortizacao.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `src/lib/amortizacao.test.ts`:

```ts
import { validate } from './amortizacao';

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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/amortizacao.test.ts`
Expected: FAIL — `validate` is not exported.

- [ ] **Step 3: Implement `validate`**

Append to `src/lib/amortizacao.ts`:

```ts
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat: input validation with localized error keys"
```

---

### Task 5: Layer B — schedules, costs, savings

**Files:**
- Modify: `src/lib/amortizacao.ts` (append)
- Test: `src/lib/amortizacao.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `src/lib/amortizacao.test.ts`:

```ts
import { buildSchedule, buildSchedules, repaymentCost, computeSavings, monthlyRate as mr } from './amortizacao';

describe('buildSchedule (Layer B, full precision)', () => {
  it('baseline V1: n months, balance reaches 0, sums are consistent', () => {
    const s = buildSchedule(150000, mr(3.5), 673.567032);
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
  const V1 = { capital: 150000, installments: 360, annualRatePct: 3.5, amortization: 10000 };
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
  const V1 = { capital: 150000, installments: 360, annualRatePct: 3.5, amortization: 10000 };
  it('net savings = interest saved minus costs', () => {
    const { baseline, scenario } = buildSchedules(V1, 'reduceTerm');
    const s = computeSavings(baseline, scenario, V1.amortization, 0.5);
    expect(s.interestSaved).toBeGreaterThan(0);
    expect(s.cost.total).toBe(52);
    expect(s.netSavings).toBeCloseTo(s.interestSaved - 52, 2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/amortizacao.test.ts`
Expected: FAIL — `buildSchedule` is not exported.

- [ ] **Step 3: Implement Layer B**

Append to `src/lib/amortizacao.ts`:

```ts
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
const EMPTY_SCHEDULE: Schedule = { rows: [], totalInterest: 0, totalPaid: 0, months: 0 };

export function buildSchedule(startBalance: number, i: number, payment: number): Schedule {
  if (startBalance <= 0 || payment <= 0) return EMPTY_SCHEDULE;
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

export function buildSchedules(input: SimulationInput, strategy: Strategy): SchedulePair {
  const i = monthlyRate(input.annualRatePct);
  const pmtOld = pmt(input.capital, i, input.installments);
  const baseline = buildSchedule(input.capital, i, pmtOld);
  const Bn = input.capital - input.amortization;
  let scenario: Schedule;
  if (Bn <= 0) {
    scenario = EMPTY_SCHEDULE;
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amortizacao.ts src/lib/amortizacao.test.ts
git commit -m "feat: full-precision schedules, repayment costs and savings (Layer B)"
```

---

### Task 6: Locale formatting and parsing

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatEuro, formatSignedEuro, formatInt, formatSignedInt, parseNumber } from './format';

// Intl grouping/space characters vary (NBSP vs narrow NBSP); normalize for assertions.
const norm = (s: string) => s.replace(/[  \s]/g, ' ');

describe('formatEuro', () => {
  it('pt: comma decimals, € suffix', () => {
    // pt-PT CLDR has minimumGroupingDigits=2: NO group separator below 10 000.
    expect(norm(formatEuro(1234.56, 'pt'))).toBe('1234,56 €');
    expect(norm(formatEuro(150000, 'pt'))).toMatch(/^150 000,00 €$/);
    expect(norm(formatEuro(673.57, 'pt'))).toBe('673,57 €');
  });
  it('en: dot decimals, € prefix', () => {
    expect(norm(formatEuro(1234.56, 'en'))).toMatch(/^€ ?1,234\.56$/);
  });
});

describe('signed formats (Diferença column)', () => {
  it('shows explicit sign except zero', () => {
    expect(norm(formatSignedEuro(-29.17, 'pt'))).toMatch(/^-29,17 €$/);
    expect(norm(formatSignedEuro(29.16, 'pt'))).toMatch(/^\+29,16 €$/);
    expect(formatSignedInt(-40, 'pt')).toBe('-40');
    expect(formatSignedInt(0, 'pt')).toBe('0');
  });
});

describe('formatInt', () => {
  it('formats whole numbers', () => {
    expect(formatInt(360, 'pt')).toBe('360');
  });
});

describe('parseNumber', () => {
  it('pt: comma decimal, dot/space grouping', () => {
    expect(parseNumber('3,5', 'pt')).toBe(3.5);
    expect(parseNumber('1.234,56', 'pt')).toBe(1234.56);
    expect(parseNumber('1.234', 'pt')).toBe(1234); // dot followed by 3 digits = grouping
    expect(parseNumber('1.5', 'pt')).toBe(1.5); // dot not followed by 3 digits = decimal
    expect(parseNumber('150 000', 'pt')).toBe(150000);
  });
  it('en: dot decimal, comma grouping', () => {
    expect(parseNumber('3.5', 'en')).toBe(3.5);
    expect(parseNumber('1,234.56', 'en')).toBe(1234.56);
    expect(parseNumber('1,234', 'en')).toBe(1234);
    expect(parseNumber('1,5', 'en')).toBe(1.5); // continental habit: comma + 1-2 digits = decimal
  });
  it('rejects garbage and empties', () => {
    expect(parseNumber('', 'pt')).toBeNull();
    expect(parseNumber('abc', 'pt')).toBeNull();
    expect(parseNumber('12abc', 'en')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/format.ts`**

```ts
export type Locale = 'pt' | 'en';

const INTL: Record<Locale, string> = { pt: 'pt-PT', en: 'en-IE' };

/**
 * Some ICU versions emit narrow no-break space (U+202F) as the group/currency
 * separator. Normalize to NBSP so server-rendered HTML and client hydration
 * always produce byte-identical strings (React 19 hydration determinism).
 */
const nbsp = (s: string): string => s.replace(/ /g, ' ');

export function formatEuro(value: number, locale: Locale): string {
  return nbsp(new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'EUR' }).format(value));
}

export function formatSignedEuro(value: number, locale: Locale): string {
  return nbsp(
    new Intl.NumberFormat(INTL[locale], {
      style: 'currency',
      currency: 'EUR',
      signDisplay: 'exceptZero',
    }).format(value),
  );
}

export function formatInt(value: number, locale: Locale): string {
  return nbsp(new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 0 }).format(value));
}

export function formatSignedInt(value: number, locale: Locale): string {
  return nbsp(
    new Intl.NumberFormat(INTL[locale], {
      maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    }).format(value),
  );
}

/**
 * Parse user input per locale convention.
 * pt: comma is decimal; a dot followed by exactly 3 digits is grouping ("1.234"),
 *     otherwise the dot is treated as a decimal typo ("3.5" -> 3.5).
 * en: dot is decimal; a comma followed by 1-2 digits is treated as a continental
 *     decimal ("1,5" -> 1.5), otherwise commas are grouping.
 */
export function parseNumber(input: string, locale: Locale): number | null {
  let s = input.trim().replace(/[\s  €%]/g, '');
  if (s === '') return null;
  if (locale === 'pt') {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(',', '.');
    }
  } else {
    if (/^\d+,\d{1,2}$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS. Note: pt-PT omits the grouping separator below 10 000 (CLDR
`minimumGroupingDigits=2`) — that is correct behavior, not a bug. If a currency
assertion fails on spacing only, adjust the test regex for the runner's ICU output —
never change the formatter to hardcode strings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: locale-aware euro/int formatting and tolerant number parsing"
```

---

### Task 7: i18n dictionaries

**Files:**
- Create: `src/i18n/types.ts`, `src/i18n/pt.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`
- Test: `src/i18n/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/i18n/i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dicts, tpl } from './index';

describe('i18n', () => {
  it('exposes pt and en dictionaries', () => {
    expect(dicts.pt.meta.title).toContain('Amortização');
    expect(dicts.en.meta.title).toContain('Mortgage');
  });
  it('both locales have the same FAQ count', () => {
    expect(dicts.pt.faq.items.length).toBe(dicts.en.faq.items.length);
    expect(dicts.pt.faq.items.length).toBeGreaterThanOrEqual(6);
  });
  it('tpl substitutes placeholders', () => {
    expect(tpl('Poupas {amount} em juros', { amount: '100 €' })).toBe('Poupas 100 € em juros');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/i18n/types.ts`**

```ts
export interface FaqItem {
  q: string;
  a: string;
}

export interface Dict {
  meta: { title: string; description: string };
  hero: { h1: string; tagline: string };
  form: {
    legend: string;
    capital: string;
    installments: string;
    rate: string;
    amortization: string;
    commission: string;
    commissionHelp: string;
    commissionOptions: { none: string; variable: string; fixed: string; custom: string };
    customRate: string;
    errors: Record<'required' | 'positive' | 'integer' | 'negative' | 'exceedsCapital', string>;
  };
  scenarios: {
    reduceTerm: { title: string; subtitle: string };
    reduceInstallment: { title: string; subtitle: string };
  };
  cards: {
    summary: string;
    caption: string;
    current: string;
    updated: string;
    diff: string;
    interest: string;
    principal: string;
    installment: string;
    installmentNote: string;
    remaining: string;
  };
  banner: {
    saves: string;
    fullPayoff: string;
    grossInterest: string;
    commission: string;
    stampDuty: string;
    net: string;
  };
  chart: { title: string; baseline: string; scenario: string; years: string };
  table: { show: string; hide: string; month: string; interest: string; principal: string; payment: string; balance: string; total: string };
  faq: { title: string; items: FaqItem[] };
  footer: { disclaimer: string; rulesAsOf: string };
  lang: { label: string; pt: string; en: string };
  notFound: { title: string; body: string; back: string };
}
```

- [ ] **Step 4: Write `src/i18n/pt.ts`**

```ts
import type { Dict } from './types';

export const pt: Dict = {
  meta: {
    title: 'Simulador de Amortização Antecipada – Crédito Habitação',
    description:
      'Calcule quanto poupa em juros ao amortizar o crédito habitação. Compare reduzir prestação ou prazo, com comissões de reembolso antecipado incluídas. Grátis.',
  },
  hero: {
    h1: 'Simulador de Amortização Antecipada do Crédito Habitação',
    tagline:
      'Descubra quanto poupa em juros ao amortizar antecipadamente — e compare as duas opções: reduzir o prazo ou reduzir a prestação.',
  },
  form: {
    legend: 'Dados do seu crédito',
    capital: 'Capital em Dívida',
    installments: 'Nº de Prestações em Falta',
    rate: 'Taxa de Juro (Spread + Euribor)',
    amortization: 'Valor a Amortizar',
    commission: 'Comissão de reembolso antecipado',
    commissionHelp:
      'Máximo legal: 0,5% em taxa variável, 2% em taxa fixa, sobre o capital reembolsado. Acresce Imposto do Selo de 4% sobre a comissão. O seu contrato pode prever um valor inferior.',
    commissionOptions: {
      none: 'Isento (0%)',
      variable: 'Taxa variável (0,5%)',
      fixed: 'Taxa fixa (2%)',
      custom: 'Outra…',
    },
    customRate: 'Comissão personalizada (%)',
    errors: {
      required: 'Campo obrigatório',
      positive: 'Tem de ser superior a zero',
      integer: 'Tem de ser um número inteiro',
      negative: 'Não pode ser negativo',
      exceedsCapital: 'Não pode ser superior ao capital em dívida',
    },
  },
  scenarios: {
    reduceTerm: {
      title: 'Diminuir Prazo',
      subtitle: 'Mantém a prestação mensal e termina o crédito mais cedo.',
    },
    reduceInstallment: {
      title: 'Diminuir Prestação',
      subtitle: 'Mantém o prazo e passa a pagar uma prestação mais baixa.',
    },
  },
  cards: {
    summary: 'Sumário',
    caption: 'Valores da próxima prestação mensal.',
    current: 'Valores Atuais',
    updated: 'Novos Valores',
    diff: 'Diferença',
    interest: 'Juros',
    principal: 'Capital Amortizado',
    installment: 'Prestação',
    installmentNote: '(juros + capital)',
    remaining: 'Nº de Prestações em Falta',
  },
  banner: {
    saves: 'Poupas {amount} em juros',
    fullPayoff: 'Liquidação total do crédito — deixas de pagar juros.',
    grossInterest: 'Juros poupados',
    commission: 'Comissão',
    stampDuty: 'Imposto do Selo (4%)',
    net: 'Poupança líquida',
  },
  chart: {
    title: 'Capital em dívida ao longo do tempo',
    baseline: 'Sem amortizar',
    scenario: 'Com amortização',
    years: 'anos',
  },
  table: {
    show: 'Ver plano de pagamentos mês a mês',
    hide: 'Esconder plano de pagamentos',
    month: 'Mês',
    interest: 'Juros',
    principal: 'Capital',
    payment: 'Prestação',
    balance: 'Capital em Dívida',
    total: 'Total',
  },
  faq: {
    title: 'Perguntas Frequentes',
    items: [
      {
        q: 'Vale a pena amortizar o crédito habitação?',
        a: 'Em regra, amortizar compensa quando a taxa de juro do crédito é superior ao retorno líquido que conseguiria com esse dinheiro (depósitos, certificados de aforro, investimentos). Antes de amortizar, garanta um fundo de emergência. Este simulador mostra exatamente quanto pouparia em juros em cada opção.',
      },
      {
        q: 'Devo reduzir o prazo ou a prestação?',
        a: 'Reduzir o prazo poupa mais juros: continua a pagar a mesma prestação, mas durante menos tempo. Reduzir a prestação dá folga imediata no orçamento mensal, mantendo o prazo. Compare os dois cenários acima — a poupança em juros é normalmente muito superior na redução de prazo.',
      },
      {
        q: 'Quanto custa amortizar antecipadamente em 2026?',
        a: 'Desde 1 de janeiro de 2026, os bancos podem cobrar a comissão de reembolso antecipado: até 0,5% do capital reembolsado em contratos de taxa variável e até 2% em período de taxa fixa, acrescida de Imposto do Selo de 4% sobre a comissão. A isenção temporária para créditos a taxa variável (habitação própria permanente) terminou a 31 de dezembro de 2025. O seu contrato pode prever uma comissão inferior — consulte o preçário do banco.',
      },
      {
        q: 'Preciso de avisar o banco com antecedência?',
        a: 'Sim. A amortização parcial pode ser feita em qualquer momento coincidente com o vencimento de uma prestação, com pré-aviso de 7 dias úteis. O reembolso total exige pré-aviso de 10 dias úteis.',
      },
      {
        q: 'Há situações isentas de comissão?',
        a: 'Sim. Por lei, não há comissão quando o reembolso é motivado por morte, desemprego ou deslocação profissional de um dos titulares. Além disso, o contrato pode simplesmente não prever comissão.',
      },
      {
        q: 'Como é calculada a prestação?',
        a: 'Os bancos portugueses usam o sistema francês: prestações constantes de capital e juros, com taxa mensal igual à TAN (Euribor + spread) a dividir por 12. A simulação assume que a Euribor se mantém constante até ao fim do contrato; nos créditos de taxa variável, a prestação real será revista a cada 3, 6 ou 12 meses.',
      },
      {
        q: 'Os meus dados são guardados?',
        a: 'Não. Todos os cálculos são feitos no seu navegador. Nenhum dado é enviado para servidores, não usamos cookies nem ferramentas de análise.',
      },
    ],
  },
  footer: {
    disclaimer:
      'Esta simulação é meramente informativa e não constitui aconselhamento financeiro. Os valores assumem Euribor constante e podem diferir em cêntimos dos valores do banco devido a arredondamentos e convenções de contagem de dias. Prevalecem sempre o contrato de crédito, a FINE e o preçário do banco.',
    rulesAsOf: 'Regras de comissões em vigor à data de junho de 2026.',
  },
  lang: { label: 'Idioma', pt: 'Português', en: 'English' },
  notFound: {
    title: 'Página não encontrada',
    body: 'A página que procura não existe.',
    back: 'Voltar ao simulador',
  },
};
```

- [ ] **Step 5: Write `src/i18n/en.ts`**

```ts
import type { Dict } from './types';

export const en: Dict = {
  meta: {
    title: 'Early Mortgage Repayment Calculator – Portugal',
    description:
      'Calculate how much interest you save by repaying your Portuguese mortgage early. Compare a lower monthly payment vs a shorter term, including early repayment fees. Free.',
  },
  hero: {
    h1: 'Early Mortgage Repayment Calculator (Portugal)',
    tagline:
      'See how much interest an overpayment saves on your Portuguese mortgage — and compare both options: shorten the term or lower the monthly payment.',
  },
  form: {
    legend: 'Your mortgage details',
    capital: 'Outstanding Capital',
    installments: 'Remaining Installments',
    rate: 'Interest Rate (Spread + Euribor)',
    amortization: 'Amount to Repay',
    commission: 'Early repayment fee',
    commissionHelp:
      'Legal maximum in Portugal: 0.5% on variable-rate and 2% on fixed-rate periods, charged on the capital repaid, plus 4% stamp duty on the fee. Your contract may set a lower fee.',
    commissionOptions: {
      none: 'Exempt (0%)',
      variable: 'Variable rate (0.5%)',
      fixed: 'Fixed rate (2%)',
      custom: 'Custom…',
    },
    customRate: 'Custom fee (%)',
    errors: {
      required: 'This field is required',
      positive: 'Must be greater than zero',
      integer: 'Must be a whole number',
      negative: 'Cannot be negative',
      exceedsCapital: 'Cannot exceed the outstanding capital',
    },
  },
  scenarios: {
    reduceTerm: {
      title: 'Shorten the Term',
      subtitle: 'Keep the same monthly payment and finish the mortgage earlier.',
    },
    reduceInstallment: {
      title: 'Lower the Payment',
      subtitle: 'Keep the term and pay a smaller monthly installment.',
    },
  },
  cards: {
    summary: 'Summary',
    caption: 'Breakdown of the next monthly installment.',
    current: 'Current Values',
    updated: 'New Values',
    diff: 'Difference',
    interest: 'Interest',
    principal: 'Principal Repaid',
    installment: 'Installment',
    installmentNote: '(interest + principal)',
    remaining: 'Remaining Installments',
  },
  banner: {
    saves: 'You save {amount} in interest',
    fullPayoff: 'Full payoff — you stop paying interest entirely.',
    grossInterest: 'Interest saved',
    commission: 'Early repayment fee',
    stampDuty: 'Stamp duty (4%)',
    net: 'Net savings',
  },
  chart: {
    title: 'Outstanding balance over time',
    baseline: 'Without repaying',
    scenario: 'With early repayment',
    years: 'years',
  },
  table: {
    show: 'Show month-by-month payment schedule',
    hide: 'Hide payment schedule',
    month: 'Month',
    interest: 'Interest',
    principal: 'Principal',
    payment: 'Payment',
    balance: 'Balance',
    total: 'Total',
  },
  faq: {
    title: 'Frequently Asked Questions',
    items: [
      {
        q: 'Is it worth paying off my mortgage early?',
        a: 'Overpaying usually pays off when your mortgage rate is higher than the net return you could earn on that money elsewhere (deposits, savings certificates, investments). Keep an emergency fund before overpaying. This calculator shows exactly how much interest each option saves.',
      },
      {
        q: 'Should I shorten the term or lower the payment?',
        a: 'Shortening the term saves more interest: you keep paying the same installment, but for less time. Lowering the payment gives immediate monthly budget relief while keeping the term. Compare both scenarios above — term reduction usually saves considerably more.',
      },
      {
        q: 'What does early repayment cost in Portugal in 2026?',
        a: 'Since 1 January 2026, Portuguese banks may charge an early repayment fee: up to 0.5% of the capital repaid on variable-rate contracts and up to 2% during fixed-rate periods, plus 4% stamp duty on the fee. The temporary exemption for variable-rate loans (own permanent residence) ended on 31 December 2025. Your contract may set a lower fee — check your bank’s price list.',
      },
      {
        q: 'Do I need to notify the bank in advance?',
        a: 'Yes. A partial repayment can be made on any installment due date with 7 business days’ notice. A full payoff requires 10 business days’ notice.',
      },
      {
        q: 'Are there fee exemptions?',
        a: 'Yes. By law, no fee may be charged when the repayment is due to death, unemployment or professional relocation of a borrower. Your contract may also simply waive the fee.',
      },
      {
        q: 'How is the installment calculated?',
        a: 'Portuguese banks use the French amortization system: constant installments of principal and interest, with a monthly rate equal to the annual nominal rate (Euribor + spread) divided by 12. The simulation assumes Euribor stays constant; on variable-rate loans the real installment is reset every 3, 6 or 12 months.',
      },
      {
        q: 'Is my data stored anywhere?',
        a: 'No. Everything runs in your browser. No data is sent to any server, and there are no cookies or analytics.',
      },
    ],
  },
  footer: {
    disclaimer:
      'This simulation is for information only and is not financial advice. Figures assume a constant Euribor and may differ by cents from your bank’s values due to rounding and day-count conventions. Your credit agreement, the FINE and your bank’s price list always prevail.',
    rulesAsOf: 'Fee rules current as of June 2026.',
  },
  lang: { label: 'Language', pt: 'Português', en: 'English' },
  notFound: {
    title: 'Page not found',
    body: 'The page you are looking for does not exist.',
    back: 'Back to the calculator',
  },
};
```

- [ ] **Step 6: Write `src/i18n/index.ts`**

```ts
import type { Locale } from '../lib/format';
import type { Dict } from './types';
import { pt } from './pt';
import { en } from './en';

export type { Dict, FaqItem } from './types';

export const dicts: Record<Locale, Dict> = { pt, en };

/** Substitute `{key}` placeholders in a translated string. */
export function tpl(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/i18n/
git commit -m "feat: typed PT/EN dictionaries with FAQ content and tpl helper"
```

---

### Task 8: Base layout with SEO head, pages skeleton, 404

**Files:**
- Create: `src/layouts/Base.astro`, `src/pages/en/index.astro`, `src/pages/404.astro`, `public/favicon.svg`
- Modify: `src/pages/index.astro` (replace placeholder)

- [ ] **Step 1: Write `src/layouts/Base.astro`**

```astro
---
import type { Locale } from '../lib/format';
import { dicts } from '../i18n';

interface Props {
  locale: Locale;
  noindex?: boolean;
}

const { locale, noindex = false } = Astro.props;
const dict = dicts[locale];

const SITE_ROOT = 'https://natobytes.github.io/simulador-amortizacao/';
const urls = { pt: SITE_ROOT, en: `${SITE_ROOT}en/` } as const;
const canonical = urls[locale];

const rawBase = import.meta.env.BASE_URL;
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

const htmlLang = locale === 'pt' ? 'pt-PT' : 'en';

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: dict.meta.title,
  url: canonical,
  description: dict.meta.description,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript',
  inLanguage: htmlLang,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
  featureList: [
    dict.scenarios.reduceTerm.title,
    dict.scenarios.reduceInstallment.title,
    dict.banner.grossInterest,
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: dict.faq.items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};
---

<!doctype html>
<html lang={htmlLang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{dict.meta.title}</title>
    <meta name="description" content={dict.meta.description} />
    {noindex && <meta name="robots" content="noindex" />}
    <link rel="canonical" href={canonical} />
    <link rel="alternate" hreflang="pt-PT" href={urls.pt} />
    <link rel="alternate" hreflang="pt" href={urls.pt} />
    <link rel="alternate" hreflang="en" href={urls.en} />
    <link rel="alternate" hreflang="x-default" href={urls.pt} />
    <link rel="icon" type="image/svg+xml" href={`${base}favicon.svg`} />
    <link rel="sitemap" href={`${base}sitemap-index.xml`} />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={dict.meta.title} />
    <meta property="og:description" content={dict.meta.description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={`${SITE_ROOT}og-image.png`} />
    <meta property="og:locale" content={locale === 'pt' ? 'pt_PT' : 'en_US'} />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json" set:html={JSON.stringify(webAppLd)} />
    <script type="application/ld+json" set:html={JSON.stringify(faqLd)} />
  </head>
  <body>
    <nav class="lang-switch" aria-label={dict.lang.label}>
      <a href={base} aria-current={locale === 'pt' ? 'page' : undefined}>{dict.lang.pt}</a>
      <a href={`${base}en/`} aria-current={locale === 'en' ? 'page' : undefined}>{dict.lang.en}</a>
    </nav>
    <slot />
    <footer class="site-footer">
      <p>{dict.footer.disclaimer}</p>
      <p>{dict.footer.rulesAsOf}</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { dicts } from '../i18n';

const dict = dicts.pt;
---

<Base locale="pt">
  <header class="hero">
    <h1>{dict.hero.h1}</h1>
    <p>{dict.hero.tagline}</p>
  </header>
  <main>
    <section class="calculator-slot" id="simulador">
      <!-- Calculator island added in Task 9 -->
    </section>
    <section class="faq" id="faq">
      <h2>{dict.faq.title}</h2>
      {
        dict.faq.items.map((item) => (
          <details>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))
      }
    </section>
  </main>
</Base>
```

- [ ] **Step 3: Write `src/pages/en/index.astro`**

Same structure with the EN dictionary:

```astro
---
import Base from '../../layouts/Base.astro';
import { dicts } from '../../i18n';

const dict = dicts.en;
---

<Base locale="en">
  <header class="hero">
    <h1>{dict.hero.h1}</h1>
    <p>{dict.hero.tagline}</p>
  </header>
  <main>
    <section class="calculator-slot" id="simulador">
      <!-- Calculator island added in Task 9 -->
    </section>
    <section class="faq" id="faq">
      <h2>{dict.faq.title}</h2>
      {
        dict.faq.items.map((item) => (
          <details>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))
      }
    </section>
  </main>
</Base>
```

- [ ] **Step 4: Write `src/pages/404.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { dicts } from '../i18n';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
---

<Base locale="pt" noindex>
  <main class="not-found">
    <h1>{dicts.pt.notFound.title} / {dicts.en.notFound.title}</h1>
    <p>{dicts.pt.notFound.body}</p>
    <p>{dicts.en.notFound.body}</p>
    <p>
      <a href={base}>{dicts.pt.notFound.back}</a> · <a href={`${base}en/`}>{dicts.en.notFound.back}</a>
    </p>
  </main>
</Base>
```

- [ ] **Step 5: Write a placeholder `public/favicon.svg`** (restyled in Task 11)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a3a32"/><path d="M8 22 L14 14 L19 18 L24 9" stroke="#9fd8c4" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

- [ ] **Step 6: Build and verify SEO output**

Run (note: Astro compresses HTML to one line, so count occurrences with `grep -o … | wc -l`, never `grep -c`):
```bash
npm run build
grep -o 'hreflang' dist/index.html | wc -l        # expect 4
grep -o '<link rel="canonical"[^>]*>' dist/index.html
grep -o '<link rel="canonical"[^>]*>' dist/en/index.html
grep -o 'application/ld+json' dist/index.html | wc -l   # expect 2
grep -o '<html lang="[^"]*"' dist/index.html dist/en/index.html
grep -o 'FAQPage' dist/index.html | head -1
test -f dist/404.html && echo "404 ok"
grep -o '<loc>[^<]*</loc>' dist/sitemap-0.xml
```
Expected: canonical `https://natobytes.github.io/simulador-amortizacao/` on PT and `…/en/` on EN; `lang="pt-PT"` / `lang="en"`; 4 hreflang links on each page; 2 JSON-LD blocks; 404.html present; sitemap lists both URLs with the base path and trailing slashes.

- [ ] **Step 7: Run `astro check`**

Run: `npm run check`
Expected: 0 errors (warnings acceptable).

- [ ] **Step 8: Commit**

```bash
git add src/layouts/ src/pages/ public/favicon.svg
git commit -m "feat: SEO-complete base layout, PT/EN pages, FAQ sections and 404"
```

---

### Task 9: Calculator island — form, summary cards, savings banner

**Files:**
- Create: `src/components/useDebounced.ts`, `src/components/Calculator.tsx`, `src/components/InputForm.tsx`, `src/components/SummaryCards.tsx`, `src/components/SavingsBanner.tsx`, `src/components/ScenarioPanel.tsx`
- Modify: `src/pages/index.astro`, `src/pages/en/index.astro` (mount the island)

Components in this task are functional with semantic markup and stable class names /
`data-testid` attributes; visual styling happens in Task 11. Charts and the table are
Task 10 — `ScenarioPanel` gains those children then.

- [ ] **Step 1: Write `src/components/useDebounced.ts`**

```ts
import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
```

- [ ] **Step 2: Write `src/components/InputForm.tsx`**

```tsx
import type { Dict } from '../i18n';
import type { FieldErrors, FieldKey } from '../lib/amortizacao';

export type CommissionPreset = 'none' | 'variable' | 'fixed' | 'custom';

export interface FormState {
  capital: string;
  installments: string;
  rate: string;
  amortization: string;
  commissionPreset: CommissionPreset;
  customCommission: string;
}

interface Props {
  form: FormState;
  errors: FieldErrors;
  dict: Dict;
  onChange: (next: FormState) => void;
}

interface FieldDef {
  key: keyof Pick<FormState, 'capital' | 'installments' | 'rate' | 'amortization'>;
  errorKey: FieldKey;
  label: string;
  suffix: string;
  inputMode: 'decimal' | 'numeric';
}

export default function InputForm({ form, errors, dict, onChange }: Props) {
  const fields: FieldDef[] = [
    { key: 'capital', errorKey: 'capital', label: dict.form.capital, suffix: '€', inputMode: 'decimal' },
    { key: 'installments', errorKey: 'installments', label: dict.form.installments, suffix: '', inputMode: 'numeric' },
    { key: 'rate', errorKey: 'rate', label: dict.form.rate, suffix: '%', inputMode: 'decimal' },
    { key: 'amortization', errorKey: 'amortization', label: dict.form.amortization, suffix: '€', inputMode: 'decimal' },
  ];

  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });

  return (
    <form className="input-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>{dict.form.legend}</legend>
        {fields.map((f) => {
          const error = errors[f.errorKey];
          return (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <div className="field-input">
                <input
                  id={f.key}
                  data-testid={`input-${f.key}`}
                  type="text"
                  inputMode={f.inputMode}
                  autoComplete="off"
                  value={form[f.key]}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${f.key}-error` : undefined}
                  onChange={(e) => set({ [f.key]: e.target.value } as Partial<FormState>)}
                />
                {f.suffix && <span className="suffix" aria-hidden="true">{f.suffix}</span>}
              </div>
              {error && (
                <p className="field-error" id={`${f.key}-error`} role="alert">
                  {dict.form.errors[error]}
                </p>
              )}
            </div>
          );
        })}
        <div className="field">
          <label htmlFor="commission">{dict.form.commission}</label>
          <select
            id="commission"
            data-testid="input-commission"
            value={form.commissionPreset}
            onChange={(e) => set({ commissionPreset: e.target.value as CommissionPreset })}
          >
            <option value="none">{dict.form.commissionOptions.none}</option>
            <option value="variable">{dict.form.commissionOptions.variable}</option>
            <option value="fixed">{dict.form.commissionOptions.fixed}</option>
            <option value="custom">{dict.form.commissionOptions.custom}</option>
          </select>
          <p className="field-help">{dict.form.commissionHelp}</p>
        </div>
        {form.commissionPreset === 'custom' && (
          <div className="field">
            <label htmlFor="customCommission">{dict.form.customRate}</label>
            <div className="field-input">
              <input
                id="customCommission"
                data-testid="input-customCommission"
                type="text"
                inputMode="decimal"
                value={form.customCommission}
                aria-invalid={errors.commission ? true : undefined}
                onChange={(e) => set({ customCommission: e.target.value })}
              />
              <span className="suffix" aria-hidden="true">%</span>
            </div>
            {errors.commission && (
              <p className="field-error" role="alert">{dict.form.errors[errors.commission]}</p>
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/components/SummaryCards.tsx`**

```tsx
import type { Dict } from '../i18n';
import type { InstallmentBreakdown, ScenarioResult } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro, formatInt, formatSignedEuro, formatSignedInt } from '../lib/format';

interface Props {
  result: ScenarioResult;
  dict: Dict;
  locale: Locale;
}

type RowKey = 'interest' | 'principal' | 'installment' | 'remaining';

export default function SummaryCards({ result, dict, locale }: Props) {
  const rows: { key: RowKey; label: string; note?: string }[] = [
    { key: 'interest', label: dict.cards.interest },
    { key: 'principal', label: dict.cards.principal },
    { key: 'installment', label: dict.cards.installment, note: dict.cards.installmentNote },
    { key: 'remaining', label: dict.cards.remaining },
  ];

  const plain = (b: InstallmentBreakdown, key: RowKey) =>
    key === 'remaining' ? formatInt(b.remaining, locale) : formatEuro(b[key], locale);
  const signed = (b: InstallmentBreakdown, key: RowKey) =>
    key === 'remaining' ? formatSignedInt(b.remaining, locale) : formatSignedEuro(b[key], locale);

  const columns = [
    { key: 'current' as const, title: dict.cards.current, value: plain },
    { key: 'updated' as const, title: dict.cards.updated, value: plain },
    { key: 'diff' as const, title: dict.cards.diff, value: signed },
  ];

  return (
    <div className="summary">
      <p className="summary-caption">{dict.cards.caption}</p>
      <div className="summary-grid">
        {columns.map((col) => (
          <section className={`summary-col summary-col--${col.key}`} key={col.key}>
            <h3>{col.title}</h3>
            <dl>
              {rows.map((row) => (
                <div className="summary-row" key={row.key}>
                  <dt>
                    {row.label}
                    {row.note && <small> {row.note}</small>}
                  </dt>
                  <dd data-testid={`${col.key}-${row.key}`}>{col.value(result[col.key], row.key)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/SavingsBanner.tsx`**

```tsx
import type { Dict } from '../i18n';
import { tpl } from '../i18n';
import type { SavingsSummary } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro } from '../lib/format';

interface Props {
  savings: SavingsSummary;
  fullPayoff: boolean;
  dict: Dict;
  locale: Locale;
}

export default function SavingsBanner({ savings, fullPayoff, dict, locale }: Props) {
  const headline = savings.cost.total > 0 ? savings.netSavings : savings.interestSaved;
  return (
    <aside className="savings-banner" data-testid="savings-banner">
      <p className="savings-headline">
        {tpl(dict.banner.saves, { amount: formatEuro(headline, locale) })}
      </p>
      {fullPayoff && <p className="savings-payoff">{dict.banner.fullPayoff}</p>}
      {savings.cost.total > 0 && (
        <dl className="savings-breakdown">
          <div>
            <dt>{dict.banner.grossInterest}</dt>
            <dd>{formatEuro(savings.interestSaved, locale)}</dd>
          </div>
          <div>
            <dt>{dict.banner.commission}</dt>
            <dd>−{formatEuro(savings.cost.commission, locale)}</dd>
          </div>
          <div>
            <dt>{dict.banner.stampDuty}</dt>
            <dd>−{formatEuro(savings.cost.stampDuty, locale)}</dd>
          </div>
          <div className="savings-net">
            <dt>{dict.banner.net}</dt>
            <dd>{formatEuro(savings.netSavings, locale)}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
```

- [ ] **Step 5: Write `src/components/ScenarioPanel.tsx`** (chart/table slots filled in Task 10)

```tsx
import { useMemo } from 'react';
import type { Dict } from '../i18n';
import type { SimulationInput, Strategy } from '../lib/amortizacao';
import { buildSchedules, computeSavings, simulate } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import SavingsBanner from './SavingsBanner';
import SummaryCards from './SummaryCards';

interface Props {
  strategy: Strategy;
  input: SimulationInput;
  commissionRatePct: number;
  dict: Dict;
  locale: Locale;
}

export default function ScenarioPanel({ strategy, input, commissionRatePct, dict, locale }: Props) {
  const result = useMemo(() => simulate(input, strategy), [input, strategy]);
  const { baseline, scenario } = useMemo(() => buildSchedules(input, strategy), [input, strategy]);
  const savings = useMemo(
    () => computeSavings(baseline, scenario, input.amortization, commissionRatePct),
    [baseline, scenario, input.amortization, commissionRatePct],
  );
  const meta = dict.scenarios[strategy];

  return (
    <article className="scenario" data-testid={`scenario-${strategy}`}>
      <header className="scenario-header">
        <h2>{meta.title}</h2>
        <p>{meta.subtitle}</p>
      </header>
      {/* Single live region per scenario so screen readers announce recalculations
          without double announcements from nested regions. */}
      <div className="scenario-results" aria-live="polite">
        <SavingsBanner savings={savings} fullPayoff={result.updated.remaining === 0} dict={dict} locale={locale} />
        <SummaryCards result={result} dict={dict} locale={locale} />
        {/* Task 10: <BalanceChart …/> and <ScheduleTable …/> mount here */}
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Write `src/components/Calculator.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { Dict } from '../i18n';
import type { RawInput, SimulationInput } from '../lib/amortizacao';
import { validate } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { parseNumber } from '../lib/format';
import InputForm, { type CommissionPreset, type FormState } from './InputForm';
import ScenarioPanel from './ScenarioPanel';
import { useDebounced } from './useDebounced';

const COMMISSION_PRESETS: Record<Exclude<CommissionPreset, 'custom'>, number> = {
  none: 0,
  variable: 0.5,
  fixed: 2,
};

function defaultsFor(locale: Locale): FormState {
  return {
    capital: '150000',
    installments: '360',
    rate: locale === 'pt' ? '3,5' : '3.5',
    amortization: '10000',
    commissionPreset: 'none',
    customCommission: '',
  };
}

interface Parsed {
  input: SimulationInput | null;
  errors: ReturnType<typeof validate>;
  commissionRatePct: number;
}

function parseForm(form: FormState, locale: Locale): Parsed {
  const commissionRatePct =
    form.commissionPreset === 'custom'
      ? parseNumber(form.customCommission, locale)
      : COMMISSION_PRESETS[form.commissionPreset];

  const raw: RawInput = {
    capital: parseNumber(form.capital, locale),
    installments: parseNumber(form.installments, locale),
    annualRatePct: parseNumber(form.rate, locale),
    amortization: parseNumber(form.amortization, locale),
    commissionRatePct,
  };

  const errors = validate(raw);
  const valid =
    Object.keys(errors).length === 0 &&
    raw.capital !== null &&
    raw.installments !== null &&
    raw.annualRatePct !== null &&
    raw.amortization !== null;

  return {
    input: valid
      ? {
          capital: raw.capital!,
          installments: raw.installments!,
          annualRatePct: raw.annualRatePct!,
          amortization: raw.amortization!,
        }
      : null,
    errors,
    commissionRatePct: commissionRatePct ?? 0,
  };
}

export default function Calculator({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [form, setForm] = useState<FormState>(() => defaultsFor(locale));
  const debounced = useDebounced(form, 250);
  const { input, errors, commissionRatePct } = useMemo(
    () => parseForm(debounced, locale),
    [debounced, locale],
  );

  return (
    <div className="calculator">
      <InputForm form={form} errors={errors} dict={dict} onChange={setForm} />
      {input && (
        <div className="scenarios">
          <ScenarioPanel strategy="reduceTerm" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
          <ScenarioPanel strategy="reduceInstallment" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Mount the island on both pages**

In `src/pages/index.astro`, add to the frontmatter:

```astro
import Calculator from '../components/Calculator';
```

and replace the `calculator-slot` section content:

```astro
<section class="calculator-slot" id="simulador">
  <Calculator client:load locale="pt" dict={dict} />
</section>
```

In `src/pages/en/index.astro`, same with `import Calculator from '../../components/Calculator';` and `locale="en"`.

- [ ] **Step 8: Build and verify prerendered V1 results**

`client:load` islands are server-rendered at build time, so the default-input results
(vector V1) must appear in the static HTML.

Run:
```bash
npm run build
grep -c '673,57' dist/index.html      # current installment, PT formatting — expect >= 1
grep -c '673,56' dist/index.html      # reduceTerm new installment — expect >= 1
grep -c '628,66' dist/index.html      # reduceInstallment new installment — expect >= 1
grep -c '320' dist/index.html         # new remaining term — expect >= 1
grep -c '673.57' dist/en/index.html   # EN formatting — expect >= 1
```
Expected: all greps ≥ 1. Also run `npm run check` (0 errors) and `npx vitest run` (all pass).

- [ ] **Step 9: Commit**

```bash
git add src/components/ src/pages/
git commit -m "feat: calculator island with live recalc, summary cards and savings banner"
```

---

### Task 10: Balance chart and schedule table

**Files:**
- Create: `src/components/BalanceChart.tsx`, `src/components/ScheduleTable.tsx`
- Modify: `src/components/ScenarioPanel.tsx`

- [ ] **Step 1: Write `src/components/BalanceChart.tsx`**

```tsx
import { useId } from 'react';
import type { Dict } from '../i18n';
import type { Schedule } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro, formatInt } from '../lib/format';

interface Props {
  baseline: Schedule;
  scenario: Schedule;
  startBalance: number;
  amortization: number;
  dict: Dict;
  locale: Locale;
}

const W = 640;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 36, left: 64 };

function linePath(values: number[], xMax: number, yMax: number): string {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return values
    .map((v, idx) => {
      const x = PAD.left + (idx / xMax) * innerW;
      const y = PAD.top + (1 - v / yMax) * innerH;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join('');
}

export default function BalanceChart({ baseline, scenario, startBalance, amortization, dict, locale }: Props) {
  const titleId = useId();
  const baselineValues = [startBalance, ...baseline.rows.map((r) => r.balance)];
  const scenarioValues = [startBalance - amortization, ...scenario.rows.map((r) => r.balance)];
  const xMax = Math.max(baselineValues.length - 1, 1);
  const yMax = Math.max(startBalance, 1);

  // Year grid lines every 60 months.
  const yearTicks: number[] = [];
  for (let m = 60; m <= xMax; m += 60) yearTicks.push(m);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  return (
    <figure className="balance-chart">
      <figcaption>{dict.chart.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} className="balance-chart-svg">
        <title id={titleId}>
          {dict.chart.title}: {dict.chart.baseline} vs {dict.chart.scenario}
        </title>
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="axis" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="axis" />
        {yearTicks.map((m) => {
          const x = PAD.left + (m / xMax) * innerW;
          return (
            <g key={m}>
              <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} className="grid" />
              <text x={x} y={H - PAD.bottom + 16} textAnchor="middle" className="tick">
                {formatInt(m / 12, locale)} {dict.chart.years}
              </text>
            </g>
          );
        })}
        {[0.5, 1].map((frac) => (
          <text key={frac} x={PAD.left - 6} y={PAD.top + (1 - frac) * innerH + 4} textAnchor="end" className="tick">
            {formatEuro(yMax * frac, locale)}
          </text>
        ))}
        <path d={linePath(baselineValues, xMax, yMax)} className="line line--baseline" fill="none" />
        <path d={linePath(scenarioValues, xMax, yMax)} className="line line--scenario" fill="none" />
      </svg>
      <ul className="chart-legend">
        <li className="legend--baseline">{dict.chart.baseline}</li>
        <li className="legend--scenario">{dict.chart.scenario}</li>
      </ul>
    </figure>
  );
}
```

- [ ] **Step 2: Write `src/components/ScheduleTable.tsx`**

```tsx
import { useState } from 'react';
import type { Dict } from '../i18n';
import type { Schedule } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro } from '../lib/format';

interface Props {
  schedule: Schedule;
  dict: Dict;
  locale: Locale;
}

export default function ScheduleTable({ schedule, dict, locale }: Props) {
  const [open, setOpen] = useState(false);
  if (schedule.months === 0) return null;
  return (
    <section className="schedule">
      <button
        type="button"
        className="schedule-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? dict.table.hide : dict.table.show}
      </button>
      {open && (
        <div className="schedule-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th scope="col">{dict.table.month}</th>
                <th scope="col">{dict.table.payment}</th>
                <th scope="col">{dict.table.interest}</th>
                <th scope="col">{dict.table.principal}</th>
                <th scope="col">{dict.table.balance}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{formatEuro(r.payment, locale)}</td>
                  <td>{formatEuro(r.interest, locale)}</td>
                  <td>{formatEuro(r.principal, locale)}</td>
                  <td>{formatEuro(r.balance, locale)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{dict.table.total}</th>
                <td>{formatEuro(schedule.totalPaid, locale)}</td>
                <td>{formatEuro(schedule.totalInterest, locale)}</td>
                <td>{formatEuro(schedule.totalPaid - schedule.totalInterest, locale)}</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Mount both in `src/components/ScenarioPanel.tsx`**

Add imports:

```tsx
import BalanceChart from './BalanceChart';
import ScheduleTable from './ScheduleTable';
```

Replace the `{/* Task 10: … */}` comment (inside the `scenario-results` live region) with:

```tsx
<BalanceChart
  baseline={baseline}
  scenario={scenario}
  startBalance={input.capital}
  amortization={input.amortization}
  dict={dict}
  locale={locale}
/>
<ScheduleTable schedule={scenario} dict={dict} locale={locale} />
```

- [ ] **Step 4: Build and verify**

Run:
```bash
npm run build
grep -o 'balance-chart' dist/index.html | wc -l     # expect >= 2 (one per scenario)
grep -o 'schedule-toggle' dist/index.html | wc -l   # expect >= 2
! grep -q 'schedule-table' dist/index.html && echo "table not prerendered (ok)"
npm run check
npx vitest run
```
Expected: build green, both counts ≥ 2, "table not prerendered (ok)" printed (the
table is collapsed by default so its body must NOT be in the HTML), check 0 errors,
tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: SVG balance chart and lazy month-by-month schedule table"
```

---

### Task 11: Visual design pass

**REQUIRED SUB-SKILL:** This task MUST be executed with the `frontend-design:frontend-design` skill loaded — invoke it before writing any styles.

**Files:**
- Create: `src/styles/global.css`, `assets/og-image.svg`, `scripts/generate-og.mjs`, `public/og-image.png`
- Modify: any component/layout/page markup (class names may change), `public/favicon.svg`

**Design brief (constraints the design must respect):**
- Audience: Portuguese homeowners + expats; tone: trustworthy personal finance, modern, distinctive — NOT a Twinkloo clone and NOT generic-AI-looking.
- Single page; form above, two scenario panels side-by-side ≥ 1024 px, stacked below; FAQ and footer follow.
- The summary grid must keep the three-column structure (Atuais / Novos / Diferença) with alternating-row emphasis like the reference screenshot's information hierarchy.
- Charts: style `.line--baseline` and `.line--scenario` distinctly (the SVG uses CSS classes, not inline colors).
- Keep ALL existing `data-testid` attributes, ids, aria attributes and the language-switch links. Numbers must remain in the DOM as text (no canvas).
- Accessibility: WCAG AA contrast, visible focus states, reduced-motion friendly, semantic headings preserved.
- Performance: system font stack or at most one self-hosted variable font; no CSS framework; no new JS dependencies.

- [ ] **Step 1: Invoke the frontend-design skill and design the page** — global stylesheet `src/styles/global.css` imported in `src/layouts/Base.astro` frontmatter (`import '../styles/global.css';`), styling: hero, form card, scenario panels, summary grid, savings banner, chart, table, FAQ `<details>`, footer, lang switch, 404.

- [ ] **Step 2: Replace `public/favicon.svg` with the final mark** consistent with the design.

- [ ] **Step 3: Create the social image** — design `assets/og-image.svg` (1200×630: site name, PT tagline, visual motif), then:

```bash
npm install -D sharp
```

Create `scripts/generate-og.mjs`:

```js
import sharp from 'sharp';

await sharp('assets/og-image.svg', { density: 150 })
  .resize(1200, 630)
  .png()
  .toFile('public/og-image.png');
console.log('public/og-image.png written');
```

Run: `node scripts/generate-og.mjs`
Expected: `public/og-image.png` exists, ~1200×630 (`npx sharp-cli metadata public/og-image.png` optional; or verify with `file public/og-image.png`).

- [ ] **Step 4: Verify nothing functional broke**

Run:
```bash
npm run build && npm run check && npx vitest run
grep -c '673,57' dist/index.html          # V1 values still prerendered
grep -c 'data-testid="scenario-reduceTerm"' dist/index.html
```
Expected: all green, greps ≥ 1.

- [ ] **Step 5: Visual review** — run `npm run dev`, screenshot PT and EN pages at 1440px and 390px widths (use browser tooling if available), check: layout, contrast, focus states, both scenarios visible, FAQ opens, table expands, chart legible. Iterate until polished.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: visual design system, og image and favicon"
```

---

### Task 12: README and license

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Write `README.md`** (outer fence is 4 backticks because the README
itself contains a ```bash block — copy everything between the 4-backtick markers)

````markdown
# Simulador de Amortização Antecipada · Early Mortgage Repayment Calculator

**PT** · Simulador gratuito de amortização antecipada de crédito habitação (Portugal).
Compara as duas opções — **diminuir prazo** e **diminuir prestação** — lado a lado, com
poupança em juros, comissão de reembolso antecipado (regras de 2026) e Imposto do Selo.
Todos os cálculos correm no navegador: nenhum dado sai do seu computador.

**EN** · Free early mortgage repayment (overpayment) calculator for Portuguese mortgages.
Compares both options — **shorten the term** and **lower the payment** — side by side,
with interest savings, the 2026 early-repayment fee rules and stamp duty. Everything runs
in your browser: no data ever leaves your machine.

**Live:** https://natobytes.github.io/simulador-amortizacao/ (PT) ·
https://natobytes.github.io/simulador-amortizacao/en/ (EN)

## Stack

- [Astro 6](https://astro.build) static site, React island for the calculator
- TypeScript, Vitest (engine verified against live test vectors)
- GitHub Actions → GitHub Pages

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # engine unit tests
npm run check     # astro type check
npm run build     # static build to dist/
```

## Calculation model

French amortization system (sistema francês), monthly rate = TAN/12. The
"next installment" summary replicates the rounding behavior used by Portuguese
mortgage simulators (half-to-even money rounding; the displayed installment is the
sum of independently rounded interest and principal; two-stage half-to-even rounding
of the recomputed term). Lifetime totals come from a full-precision month-by-month
schedule. See `docs/superpowers/specs/` for the full verified spec.

## Disclaimer

Informational only — not financial advice. Figures assume constant Euribor; your
contract, FINE and bank price list prevail. Fee rules current as of June 2026.
````

- [ ] **Step 2: Write `LICENSE`** — standard MIT license text with `Copyright (c) 2026 natobytes`.

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: bilingual README and MIT license"
```

---

### Task 13: CI workflow, GitHub repo, deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

Note: the pinned versions above are best guesses. BEFORE committing, verify each of
the four actions (`actions/checkout`, `actions/setup-node`, `withastro/action`,
`actions/deploy-pages`) and pin to its latest published major:

```bash
for a in actions/checkout actions/setup-node withastro/action actions/deploy-pages; do
  echo "$a: $(gh api repos/$a/tags -q '.[].name' | grep -E '^v[0-9]+$' | sort -V | tail -1)"
done
```

Use the printed majors in the workflow file (e.g. if `withastro/action` prints `v3`,
write `withastro/action@v3`).

- [ ] **Step 2: Commit the workflow**

```bash
git add .github/
git commit -m "ci: test + build + deploy to GitHub Pages"
```

- [ ] **Step 3: Verify gh auth and create the repo (no push yet)**

Run:
```bash
gh auth status
gh repo create natobytes/simulador-amortizacao --public --source . --remote origin \
  --description "Simulador de amortização antecipada de crédito habitação · Early mortgage repayment calculator (PT/EN)"
```
Expected: repo created, `origin` remote added. If org permission fails, STOP and report to the user.

- [ ] **Step 4: Enable Pages with workflow builds, then push**

Run:
```bash
gh api -X POST repos/natobytes/simulador-amortizacao/pages -f build_type=workflow
git push -u origin main
```
Expected: Pages API returns 201; push succeeds and triggers the workflow.
Contingency: if the Pages POST returns 409/422 (the API can reject repos with no
default branch yet), push first (`git push -u origin main`), then enable Pages, then
re-trigger the deploy: `gh workflow run deploy.yml --repo natobytes/simulador-amortizacao`.

- [ ] **Step 5: Watch the deploy**

`gh run watch` prompts interactively without a run ID (fails in non-TTY contexts), so
fetch the ID first:

```bash
sleep 10
RUN_ID=$(gh run list --repo natobytes/simulador-amortizacao --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --repo natobytes/simulador-amortizacao --exit-status
```
(If `RUN_ID` comes back empty, wait a few seconds and re-run the `gh run list` line.)
Expected: test, build, deploy jobs all green. Then:

```bash
curl -sI https://natobytes.github.io/simulador-amortizacao/ | head -1
```
Expected: `HTTP/2 200` (may take 1–2 minutes after the first deploy; retry a few times).

- [ ] **Step 6: Add repo topics**

```bash
gh repo edit natobytes/simulador-amortizacao \
  --add-topic calculator --add-topic mortgage --add-topic astro \
  --add-topic portugal --add-topic amortizacao --add-topic credito-habitacao
```

---

### Task 14: Post-deploy verification

No new files — live checks only.

- [ ] **Step 1: Verify SEO tags on the live site**

Run:
```bash
LIVE=https://natobytes.github.io/simulador-amortizacao/
curl -s $LIVE | grep -o 'hreflang="[^"]*"' | sort
curl -s $LIVE | grep -o '<link rel="canonical"[^>]*>'
curl -s ${LIVE}en/ | grep -o '<link rel="canonical"[^>]*>'
curl -s $LIVE | grep -o 'application/ld+json' | wc -l   # expect 2
curl -s ${LIVE}sitemap-index.xml
curl -sI ${LIVE}og-image.png | head -1
curl -sI ${LIVE}does-not-exist/ | head -1
```
Expected: hreflang set {pt-PT, pt, en, x-default}; canonicals match each page's own URL
with trailing slash; 2 JSON-LD blocks; sitemap reachable; og-image 200; missing path
returns 404.

- [ ] **Step 2: Verify V1 numbers prerendered on the live pages**

Run:
```bash
curl -s https://natobytes.github.io/simulador-amortizacao/ | grep -c '673,57'
curl -s https://natobytes.github.io/simulador-amortizacao/en/ | grep -c '673.57'
```
Expected: both ≥ 1.

- [ ] **Step 3: Interactive verification** — load the live PT page in a browser (use the
`verify` skill / browser tooling). Note pt-PT shows no grouping separator below 10 000
(e.g. `1055,68 €`, but `150 000,00 €`).
  - **V2 (PT):** Capital `200000`, Prestações `300`, Taxa `4`, Amortizar `25000` →
    Diminuir Prazo shows Prestação `1055,68 €` and `242` prestações; Diminuir Prestação
    shows `923,71 €` and `300`. Set commission to "Taxa variável (0,5%)" → banner shows
    commission `125,00 €` and stamp duty `5,00 €`.
  - **V3 (PT, banker's-rounding regression case):** Capital `135000`, Prestações `360`,
    Taxa `3,5`, Amortizar `7000` → Diminuir Prazo shows Prestação `606,20 €` and `328`
    prestações (NOT 329).
  - **V2 + V3 (EN):** repeat both on `/en/` with dot-decimal inputs (`3.5`, `4`) and
    EN formatting (`€1,055.68`, `242`; `€606.20`, `328`).
  - Test on a ~390px viewport that the two panels stack vertically.

- [ ] **Step 4: Report** — summarize live URLs, test results and any deviations. Remind
the user of the one manual follow-up: verifying the site in Google Search Console
(URL-prefix property `https://natobytes.github.io/simulador-amortizacao/`) and submitting
`sitemap-index.xml`.
