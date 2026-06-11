# Simulador de Amortização Antecipada — Design Spec

**Date:** 2026-06-10
**Repo:** `natobytes/simulador-amortizacao` (public)
**Live URL:** `https://natobytes.com/simulador-amortizacao/` (the natobytes org serves GitHub Pages under its custom domain; the github.io URL 301-redirects)

## 1. Goal

A free, client-only, bilingual (PT default + EN) web calculator for early mortgage
repayment (amortização antecipada de crédito habitação) in Portugal. It replicates the
calculation behavior of twinkloo.pt's simulator, but shows **both** strategies —
"Diminuir Prazo" (reduce term) and "Diminuir Prestação" (reduce installment) — on the
same page simultaneously, and extends it with lifetime savings, a balance chart, an
amortization table, and an optional early-repayment commission.

Non-goals: no backend, no accounts, no analytics, no cookies, no data leaves the browser.
We replicate Twinkloo's *functionality and numeric results*, not their visual design,
branding, or copy — all UI design and text are original.

## 2. Inputs

| Field | PT label | Type | Validation |
|---|---|---|---|
| Outstanding capital | Capital em Dívida | € amount | > 0 |
| Remaining installments | Nº de Prestações em Falta | integer months | ≥ 1, integer |
| Annual interest rate | Taxa de Juro (Spread+Euribor) | % (TAN) | ≥ 0 |
| Amount to repay | Valor a Amortizar | € amount | > 0, ≤ capital |
| Commission (optional) | Comissão de reembolso antecipado | preset select | Isento 0% (default) / Variável 0,5% / Fixa 2% / custom % |

- Defaults pre-filled with a realistic example: 150 000 €, 360 months, 3,5 %, 10 000 €.
- Live recalculation on input (debounced ~250 ms); no submit button.
- Validation errors shown inline per field, localized.
- Commission cost = rate × amount repaid; stamp duty (Imposto do Selo) = 4 % of the
  commission, shown separately. No commission → no stamp duty.

## 3. Calculation engine

Pure TypeScript module `src/lib/amortizacao.ts`, framework-free, two layers.

### 3.1 Layer A — Twinkloo-exact model (summary cards)

Black-box reverse-engineered from 25 live probes against the Twinkloo endpoint;
the model reproduces every output field of every probe cent-for-cent. Independently
verified by recomputation. **Semantics: "Juros", "Capital Amortizado" and "Prestação"
are the breakdown of the NEXT SINGLE monthly installment, not lifetime totals.**

Notation:

```
i          = rate / 100 / 12          (full double precision, never rounded)
pmt(P, m)  = P*i / (1 - (1+i)^-m)     if i > 0
           = P / m                    if i == 0
round2(x)  = round half-to-even, 2 decimals  (.NET Math.Round default)
roundHE(x, dp) = round half-to-even at dp decimals
```

**Step 0 — old payment:** `PMT_old = pmt(B, n)` where B = capital owed, n = remaining installments.

**Step 1 — "Valores Atuais" (both scenarios):**

```
CurrentTax              = round2(B*i)                  // Juros
CurrentCapitalValue     = round2(PMT_old - B*i)        // Capital Amortizado
InstallmentCurrentValue = CurrentTax + CurrentCapitalValue   // SUM OF ROUNDED PARTS
CurrentRemainingInstallments = n
```

**Step 2 — new balance:** `B' = B - A` (A = amount to amortize).

**Step 3a — Diminuir Prazo (keep payment, shorten term):**

```
n_exact = ln(PMT_old / (PMT_old - B'*i)) / ln(1+i)     // i > 0
        = B' / PMT_old                                  // i == 0
n_frac  = roundHE(n_exact, 2)        // MANDATORY intermediate 2-dp rounding (round, not trunc/ceil)
PMT_new = pmt(B', n_frac)            // recomputed at the FRACTIONAL 2-dp term
Tax = round2(B'*i);  CapitalValue = round2(PMT_new - B'*i)
InstallmentValue = Tax + CapitalValue
RemainingInstallments = roundHE(n_frac, 0)   // banker's: 328.50→328, 151.50→152
```

**Step 3b — Diminuir Prestação (keep term, lower payment):**

```
PMT_new = pmt(B', n)
Tax = round2(B'*i);  CapitalValue = round2(PMT_new - B'*i)
InstallmentValue = Tax + CapitalValue
RemainingInstallments = n
```

**Step 4 — "Diferença" column:** differences of the **rounded display values**, re-rounded
to cents (±0,01 € artifacts are correct and expected):

```
TaxDiference          = round2(Tax - CurrentTax)
CapitalDiference      = round2(CapitalValue - CurrentCapitalValue)
InstallmentDiference  = round2(InstallmentValue - InstallmentCurrentValue)
RemainingInstallmentsDiference = RemainingInstallments - n
```

**Rounding rules (proven against live probes):**
- R1. Money rounds to cents half-to-even.
- R2. Interest and capital round **independently**; displayed installment is the sum of the
  two rounded parts — never `round2(PMT)` directly.
- R3. New term: two-stage — `roundHE(n_exact, 2)` then `roundHE(n_frac, 0)`. The 2-dp stage
  matters even for the integer result (151.4955 → 151.50 → 152; direct rounding gives 151).
- R4. The monthly rate and PMT_old are never rounded internally.

**Edge cases:**
- E1. `A == B`: all outputs zero, term 0. `A > B`: validation error.
- E2. For valid inputs (0 < A < B), `n_exact` is always defined and < n; no extra guard.
- E3. `i == 0`: linear branches as above; Tax = 0,00.
- E4. Tiny residual (`n_frac < 1`): clamp to one final installment —
  `RemainingInstallments = 1` (0 if B' = 0), `Tax = round2(B'*i)`, `CapitalValue = round2(B')`.

### 3.2 Layer B — full-precision schedule (savings, chart, table)

Month-by-month simulation at full floating precision, used for everything Twinkloo
doesn't show:

- **Baseline schedule:** balance B, payment PMT_old, n months.
- **Reduce-term schedule:** balance B', payment PMT_old, runs until balance ≤ 0; final
  installment adjusted to clear the residual.
- **Reduce-installment schedule:** balance B', payment PMT_new = pmt(B', n), n months,
  final installment adjusted for residual cents.
- Per month: interest = balance × i; principal = payment − interest; new balance.
- **Total interest** of a schedule = Σ interest. **Interest saved** = baseline total −
  scenario total. **Net savings** = interest saved − (commission + stamp duty).

Layer B values power: the savings banner, the balance-over-time chart, the amortization
table, and the totals row. Layer A values power the summary cards, so cards always match
Twinkloo exactly.

### 3.3 Verified test vectors (encode all in unit tests)

Cell format: Juros / Capital / Prestação / Prestações em Falta. LIVE = confirmed against
the Twinkloo endpoint; MODEL = derived from the verified model.

- **V1 (LIVE)** B=150000, n=360, rate=3.5, A=10000. PMT_old=673.567032.
  Atuais: 437.50 / 236.07 / 673.57 / 360.
  Prazo: n_exact=320.000459, n_frac=320.00, PMT_new=673.567617 → 408.33 / 265.23 / 673.56 / 320; difs −29.17 / +29.16 / **−0.01** / −40.
  Prestação: PMT_new=628.662563 → 408.33 / 220.33 / 628.66 / 360; difs −29.17 / −15.74 / −44.91 / 0.
- **V2 (LIVE)** B=200000, n=300, rate=4.0, A=25000. PMT_old=1055.673681.
  Atuais: 666.67 / 389.01 / **1055.68** / 300 (sum-of-rounded ≠ round2(PMT_old)=1055.67).
  Prazo: n_exact=241.672275 → n_frac 241.67 → term 242; PMT_new=1055.680151 → 583.33 / **472.35** / 1055.68 / 242 (using PMT_old gives 472.34 — wrong).
  Prestação: PMT_new=923.714471 → 583.33 / 340.38 / 923.71 / 300.
- **V3 (LIVE)** B=135000, n=360, rate=3.5, A=7000. PMT_old=606.210329.
  Prazo: n_exact=328.495248 → 328.50 → banker's → **328** (ceil/half-up=329 must fail); PMT_new=606.205095 → 373.33 / 232.87 / 606.20 / 328.
  Prestação (MODEL): PMT_new=574.777200 → 373.33 / 201.44 / 574.77 / 360.
- **V4 (MODEL)** B=100000, n=180, rate=2.75, A=5000 → Prazo: 217.71 / 460.92 / 678.63 / 169; Prestação: 217.71 / 426.98 / 644.69 / 180.
- **V5 (MODEL)** B=80000, n=120, rate=6.0, A=15000 → Prazo: 325.00 / 563.20 / 888.20 / 91; Prestação: 325.00 / 396.63 / 721.63 / 120.
- **V6 (MODEL, zero rate)** B=120000, n=240, rate=0, A=20000. PMT_old=500.00 → Prazo: 0.00 / 500.00 / 500.00 / 200; Prestação: 0.00 / 416.67 / 416.67 / 240.
- **V7 (MODEL, full payoff)** B=50000, n=60, rate=3.0, A=50000 → both: 0.00 / 0.00 / 0.00 / 0. A=50001 → validation error.
- **V8 (MODEL, tiny residual)** B=50000, n=12, rate=3.0, A=49900 → Prazo with E4 clamp: 0.25 / 100.00 / 100.25 / 1; Prestação: 0.25 / 8.22 / 8.47 / 12.
- **V9 (rounding unit tests):** roundHE(151.4955, 2)=151.50 → int 152 (direct int rounding gives 151 — must fail); roundHE(328.50, 0)=328; roundHE(151.50, 0)=152; roundHE(213.50, 0)=214; roundHE(153.8386, 2)=153.84; roundHE(211.4361, 2)=211.44 (truncation must fail).

Key assertions: (1) installment = sum of rounded parts, never round2(PMT); (2) reduce-term
capital comes from PMT recomputed at the fractional 2-dp term; (3) two-stage half-to-even
term rounding; (4) difference fields are differences of displayed values; (5) ceil-based
term must fail V1 (321) and V3 (329).

## 4. Architecture

- **Astro 6** static site (`output: 'static'`), TypeScript strict.
- **One React island** (`@astrojs/react`, `client:load`) for the calculator — it is
  above-the-fold and always needed.
- `astro.config.mjs`: `site: 'https://natobytes.github.io'`, `base: '/simulador-amortizacao'`,
  `i18n: { defaultLocale: 'pt', locales: ['pt', 'en'], routing: { prefixDefaultLocale: false } }`,
  integrations: react, sitemap (plain — no i18n option; HTML hreflang link tags are the
  single source of truth, see §6).

### File layout

```
src/
  lib/
    amortizacao.ts        # Layer A + Layer B + rounding helpers (pure TS)
    amortizacao.test.ts   # Vitest: V1–V9 + rounding assertions
    format.ts             # Intl.NumberFormat helpers per locale
  i18n/
    pt.ts  en.ts  index.ts  # typed dictionaries + t() helper
  components/
    Calculator.tsx        # island root: form state + results
    InputForm.tsx         # inputs + commission select + validation
    ScenarioPanel.tsx     # one scenario: banner + cards + chart + table
    SummaryCards.tsx      # Atuais / Novos / Diferença grid (screenshot layout)
    SavingsBanner.tsx     # lifetime interest saved, net of costs
    BalanceChart.tsx      # custom SVG, balance over time before/after
    ScheduleTable.tsx     # expandable month-by-month table
  layouts/Base.astro      # <head>: meta, hreflang, canonical, JSON-LD, OG
  pages/
    index.astro           # PT
    en/index.astro        # EN
    404.astro
public/                   # favicon, og-image, robots-adjacent assets
.github/workflows/deploy.yml
```

The island receives the locale + translated strings as props from the Astro page, so
the React bundle contains no i18n routing logic.

## 5. UI (single page per language)

1. **Hero:** H1 + one-line value proposition.
2. **Form card:** the 5 inputs (§2).
3. **Results:** both scenarios always visible — side-by-side ≥ 1024 px, stacked below.
   Each `ScenarioPanel` ("Diminuir Prazo" / "Diminuir Prestação"):
   - `SavingsBanner` — "Poupas X € em juros" (net of commission + stamp duty when set).
   - `SummaryCards` — three columns (Valores Atuais / Novos Valores / Diferença) × four
     rows (Juros, Capital Amortizado, Prestação (juros+capital), Nº de Prestações em
     Falta), exactly like the reference screenshot, with a small clarifying caption
     "valores da próxima prestação mensal".
   - `BalanceChart` — SVG line chart, outstanding balance by month, baseline vs scenario.
   - `ScheduleTable` — collapsed by default; month, juros, capital, prestação,
     capital em dívida. Rows are rendered only when the user expands the section (lazy
     mount); plain table rendering is fine up to the 600-row maximum (50-year loan).
4. **FAQ section:** 6–8 visible Q&As targeting long-tail keywords (vale a pena amortizar?;
   reduzir prazo ou prestação?; comissões 2026: 0,5 % variável / 2 % fixa + IS 4 %;
   pré-aviso de 7 dias úteis; isenção por desemprego/morte/mobilidade profissional).
5. **Footer:** disclaimer — estimates only; assumes constant Euribor; bank rounding and
   day-count may differ by cents; contract/FINE prevails; commission rules as of June 2026.

Number formatting: `Intl.NumberFormat('pt-PT', …)` → `150 000,00 €` (note: pt-PT omits
the grouping separator below 10 000, e.g. `1055,68 €`); `en-IE` style → `€1,234.56`.

**Visual design:** original, produced with the frontend-design skill during implementation.
Distinctive, finance-trustworthy, accessible (labels, aria-live on results, keyboard
navigable, WCAG AA contrast). Not a copy of Twinkloo's look.

## 6. i18n & SEO

- PT at `/`, EN at `/en/`; visible language toggle with plain `<a href>` links; **no**
  Accept-Language redirects.
- `<html lang>` per page; fully translated title/meta/H1/JSON-LD.
- **Titles** — PT: "Simulador de Amortização Antecipada – Crédito Habitação";
  EN: "Early Mortgage Repayment Calculator – Portugal".
  **H1** — PT: "Simulador de Amortização Antecipada do Crédito Habitação";
  EN: "Early Mortgage Repayment Calculator (Portugal)". EN copy also uses
  "overpayment" and "payoff" wording in body/FAQ to catch UK/US phrasing.
- **hreflang** on both pages (absolute URLs, trailing slashes, reciprocal + self):
  `pt-PT` → root, `pt` → root, `en` → `/en/`, `x-default` → root. Self-referencing
  canonicals; hreflang URLs must equal canonicals exactly. (URLs moved to
  https://natobytes.com/... at deploy time — the org's custom domain; config `site`
  updated accordingly)
- **JSON-LD:** `WebApplication` (`applicationCategory: "FinanceApplication"`,
  `operatingSystem: "Any"`, `offers: {price: 0, priceCurrency: "EUR"}`,
  `isAccessibleForFree: true`, `inLanguage` per page) + lightweight `FAQPage` (no rich
  result since 2026, kept for machine/AI readability). No fabricated ratings.
- `@astrojs/sitemap` **without** i18n alternates — HTML link tags are the single source
  of hreflang truth (two sources that don't agree exactly are worse than one; the sitemap
  i18n option cannot emit the extra `pt` and `x-default` entries). `<link rel="sitemap">`
  in head. robots.txt at a project-site path is ignored by crawlers — rely on Search
  Console submission (manual step for the owner, post-launch).
- OG/Twitter meta + 1200×630 og-image; custom 404 page.
- All URLs (links, canonicals, hreflang, sitemap, og:url) include the
  `/simulador-amortizacao/` base path and trailing slash.

## 7. Testing & CI

- **Vitest:** all vectors V1–V9, rounding helpers, schedule invariants (final balance 0;
  Σ principal = capital; interest saved > 0 for A > 0, i > 0), commission/stamp-duty math,
  validation rules.
- **CI (GitHub Actions):** on push to main — `astro check` + `vitest run` + build, then
  deploy via `withastro/action@v6` → `actions/deploy-pages@v5` (Pages source: GitHub Actions).
- Manual verification post-deploy: spot-check V1/V2/V3 numbers in the live UI in both
  languages.

## 8. Deliverables / out of scope

Deliverables: public repo `natobytes/simulador-amortizacao` with MIT license, README
(PT + EN), deployed GitHub Pages site, this spec, and an implementation plan.

Out of scope for v1: custom domain, Search Console verification (owner manual step),
fixed/mixed-rate schedule variations beyond the commission presets, Euribor forecasting,
PDF export.
