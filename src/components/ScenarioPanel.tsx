import { useMemo } from 'react';
import type { Dict } from '../i18n';
import type { SimulationInput, Strategy } from '../lib/amortizacao';
import { buildSchedules, computeSavings, simulate } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import BalanceChart from './BalanceChart';
import SavingsBanner from './SavingsBanner';
import ScheduleTable from './ScheduleTable';
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
        <span className="scenario-index" aria-hidden="true">
          {strategy === 'reduceTerm' ? '01' : '02'}
        </span>
        <h2>{meta.title}</h2>
        <p>{meta.subtitle}</p>
      </header>
      {/* Single live region per scenario so screen readers announce recalculations
          without double announcements from nested regions. */}
      <div className="scenario-results" aria-live="polite">
        <SavingsBanner savings={savings} fullPayoff={result.updated.remaining === 0} dict={dict} locale={locale} />
        <SummaryCards result={result} dict={dict} locale={locale} />
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
