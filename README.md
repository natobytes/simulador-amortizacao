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
