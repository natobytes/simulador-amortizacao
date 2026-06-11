import { useState } from 'react';
import type { Dict } from '../i18n';
import type { Schedule } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatEuro } from '../lib/format';

interface Props {
  schedule: Schedule;
  dict: Dict;
  locale: Locale;
}

export default function ScheduleTable({ schedule, dict, locale }: Props) {
  const [open, setOpen] = useState(false);
  if (schedule.months === 0) return null;
  return (
    <section className="schedule">
      <button
        type="button"
        className="schedule-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? dict.table.hide : dict.table.show}
      </button>
      {open && (
        <div className="schedule-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th scope="col">{dict.table.month}</th>
                <th scope="col">{dict.table.payment}</th>
                <th scope="col">{dict.table.interest}</th>
                <th scope="col">{dict.table.principal}</th>
                <th scope="col">{dict.table.balance}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{formatEuro(r.payment, locale)}</td>
                  <td>{formatEuro(r.interest, locale)}</td>
                  <td>{formatEuro(r.principal, locale)}</td>
                  <td>{formatEuro(r.balance, locale)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{dict.table.total}</th>
                <td>{formatEuro(schedule.totalPaid, locale)}</td>
                <td>{formatEuro(schedule.totalInterest, locale)}</td>
                <td>{formatEuro(schedule.totalPaid - schedule.totalInterest, locale)}</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
