import type { Dict } from '../i18n';
import { tpl } from '../i18n';
import type { SavingsSummary } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro } from '../lib/format';

interface Props {
  savings: SavingsSummary;
  fullPayoff: boolean;
  repaymentCount: number;
  amortizedTotal: number;
  perEvent: number;
  dict: Dict;
  locale: Locale;
}

export default function SavingsBanner({ savings, fullPayoff, repaymentCount, amortizedTotal, perEvent, dict, locale }: Props) {
  const headline = savings.cost.total > 0 ? savings.netSavings : savings.interestSaved;
  // Same string as tpl(dict.banner.saves, …), but with the amount wrapped so it
  // can be styled as the hero number of the panel.
  const [before, after] = dict.banner.saves.split('{amount}');
  return (
    <aside className="savings-banner" data-testid="savings-banner">
      <p className="savings-headline">
        {before}
        <strong className="savings-amount">{formatEuro(headline, locale)}</strong>
        {after}
      </p>
      {fullPayoff && <p className="savings-payoff">{dict.banner.fullPayoff}</p>}
      {/* Recurring plans only: a single (once) repayment is already self-evident
          from the headline, so there is no plan summary to show for it. */}
      {repaymentCount > 1 && (
        <p className="savings-repayments" data-testid="savings-repayments">
          {tpl(dict.banner.repayments, {
            count: String(repaymentCount),
            amount: formatEuro(perEvent, locale),
            total: formatEuro(amortizedTotal, locale),
          })}
        </p>
      )}
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
      <dl className="savings-totals">
        <div>
          <dt>{dict.banner.totalBefore}</dt>
          <dd data-testid="total-before">{formatEuro(savings.totalBefore, locale)}</dd>
        </div>
        <div>
          <dt>
            {dict.banner.totalAfter}
            <small> {dict.banner.totalAfterNote}</small>
          </dt>
          <dd data-testid="total-after">{formatEuro(savings.totalAfter, locale)}</dd>
        </div>
      </dl>
    </aside>
  );
}
