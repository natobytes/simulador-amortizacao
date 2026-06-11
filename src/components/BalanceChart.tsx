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
const PAD = { top: 16, right: 28, bottom: 36, left: 92 };

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
  if (xMax < 60) {
    if (xMax > 0) yearTicks.push(xMax);
  } else {
    for (let m = 60; m <= xMax; m += 60) yearTicks.push(m);
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  return (
    <figure className="balance-chart">
      <figcaption aria-hidden="true">{dict.chart.title}</figcaption>
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
