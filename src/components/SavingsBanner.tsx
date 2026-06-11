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
