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
