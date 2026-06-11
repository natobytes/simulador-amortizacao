import { useMemo, useState } from 'react';
import type { Dict } from '../i18n';
import type { RawInput, SimulationInput } from '../lib/amortizacao';
import { validate } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { parseNumber } from '../lib/format';
import InputForm, { type CommissionPreset, type FormState } from './InputForm';
import ScenarioPanel from './ScenarioPanel';
import { useDebounced } from './useDebounced';

const COMMISSION_PRESETS: Record<Exclude<CommissionPreset, 'custom'>, number> = {
  none: 0,
  variable: 0.5,
  fixed: 2,
};

function defaultsFor(locale: Locale): FormState {
  return {
    capital: '150000',
    installments: '360',
    rate: locale === 'pt' ? '3,5' : '3.5',
    amortization: '10000',
    commissionPreset: 'none',
    customCommission: '',
  };
}

interface Parsed {
  input: SimulationInput | null;
  errors: ReturnType<typeof validate>;
  commissionRatePct: number;
}

function parseForm(form: FormState, locale: Locale): Parsed {
  const commissionRatePct =
    form.commissionPreset === 'custom'
      ? parseNumber(form.customCommission, locale)
      : COMMISSION_PRESETS[form.commissionPreset];

  const raw: RawInput = {
    capital: parseNumber(form.capital, locale),
    installments: parseNumber(form.installments, locale),
    annualRatePct: parseNumber(form.rate, locale),
    amortization: parseNumber(form.amortization, locale),
    commissionRatePct,
  };

  const errors = validate(raw);
  const valid =
    Object.keys(errors).length === 0 &&
    raw.capital !== null &&
    raw.installments !== null &&
    raw.annualRatePct !== null &&
    raw.amortization !== null;

  return {
    input: valid
      ? {
          capital: raw.capital!,
          installments: raw.installments!,
          annualRatePct: raw.annualRatePct!,
          amortization: raw.amortization!,
        }
      : null,
    errors,
    commissionRatePct: commissionRatePct ?? 0,
  };
}

export default function Calculator({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [form, setForm] = useState<FormState>(() => defaultsFor(locale));
  const debounced = useDebounced(form, 250);
  const { input, errors, commissionRatePct } = useMemo(
    () => parseForm(debounced, locale),
    [debounced, locale],
  );

  return (
    <div className="calculator">
      <InputForm form={form} errors={errors} dict={dict} onChange={setForm} />
      {input && (
        <div className="scenarios">
          <ScenarioPanel strategy="reduceTerm" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
          <ScenarioPanel strategy="reduceInstallment" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
        </div>
      )}
    </div>
  );
}
