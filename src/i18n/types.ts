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
    frequency: string;
    frequencyOptions: { once: string; yearly: string; biennial: string };
    fillPrompt: string;
    errors: Record<'required' | 'positive' | 'integer' | 'negative' | 'exceedsCapital' | 'invalid', string>;
  };
  scenarios: {
    reduceTerm: { title: string; subtitle: string };
    reduceInstallment: { title: string; subtitle: string };
  };
  cards: {
    caption: string;
    captionRecurring: string;
    current: string;
    updated: string;
    diff: string;
    interest: string;
    principal: string;
    installment: string;
    installmentNote: string;
    remaining: string;
    duration: { year: string; years: string; month: string; months: string; joiner: string };
  };
  banner: {
    saves: string;
    fullPayoff: string;
    repayments: string;
    grossInterest: string;
    commission: string;
    stampDuty: string;
    net: string;
    totalBefore: string;
    totalAfter: string;
    totalAfterNote: string;
  };
  chart: { title: string; baseline: string; scenario: string; years: string };
  table: { show: string; hide: string; month: string; interest: string; principal: string; payment: string; balance: string; total: string; amortizationNote: string };
  faq: { title: string; items: FaqItem[] };
  footer: { disclaimer: string; rulesAsOf: string; byLine: string };
  lang: { label: string; pt: string; en: string };
  notFound: { title: string; body: string; back: string };
}
