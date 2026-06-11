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
