import { useMemo } from 'react';
import type { Dict } from '../i18n';
import type { ScenarioResult, SimulationInput, Strategy } from '../lib/amortizacao';
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

  const recurring = (input.frequency ?? 'once') !== 'once';
  // Under a recurring plan the cards' remaining-installments row should reflect
  // the REAL recurring payoff term (the schedule), not simulate()'s single-event
  // term. The money rows keep the simulate() snapshot (next installment after the
  // first repayment).
  const cardResult: ScenarioResult = useMemo(() => {
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
          /* nominal per-event amount the user chose; the final event may be
             capped to clear the balance, but amortizedTotal stays exact */
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
