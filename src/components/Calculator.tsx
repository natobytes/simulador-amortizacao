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

function emptyForm(): FormState {
  return {
    capital: '',
    installments: '',
    rate: '',
    amortization: '',
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
  if (form.commissionPreset === 'custom' && form.customCommission.trim() !== '' && commissionRatePct === null) {
    errors.commission = 'invalid';
  }
  // A blank field is incomplete, not wrong: suppress its error so a pristine
  // form doesn't open covered in alerts. Its raw value stays null, so no
  // results render until the user fills it in.
  if (form.capital.trim() === '') delete errors.capital;
  if (form.installments.trim() === '') delete errors.installments;
  if (form.rate.trim() === '') delete errors.rate;
  if (form.amortization.trim() === '') delete errors.amortization;
  if (form.commissionPreset === 'custom' && form.customCommission.trim() === '') delete errors.commission;
  // Conversely, a filled field that failed to parse is wrong, not missing:
  // validate() maps a null parse to 'required', which reads absurd on a
  // visibly filled field, so remap it (mirrors the customCommission handling).
  if (form.capital.trim() !== '' && raw.capital === null) errors.capital = 'invalid';
  if (form.installments.trim() !== '' && raw.installments === null) errors.installments = 'invalid';
  if (form.rate.trim() !== '' && raw.annualRatePct === null) errors.rate = 'invalid';
  if (form.amortization.trim() !== '' && raw.amortization === null) errors.amortization = 'invalid';

  const valid =
    Object.keys(errors).length === 0 &&
    raw.capital !== null &&
    raw.installments !== null &&
    raw.annualRatePct !== null &&
    raw.amortization !== null &&
    // 'custom' is an explicit opt-in to providing a rate: a blank custom
    // field means the form is incomplete, not a 0% commission.
    commissionRatePct !== null;

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
  const [form, setForm] = useState<FormState>(emptyForm);
  const debounced = useDebounced(form, 250);
  const { input, errors, commissionRatePct } = useMemo(
    () => parseForm(debounced, locale),
    [debounced, locale],
  );

  return (
    <div className="calculator">
      <InputForm form={form} errors={errors} dict={dict} onChange={setForm} />
      {/* The live region must exist from first render: screen readers ignore
          content that arrives together with the region itself, so mounting it
          inside the conditional would leave the first results unannounced. */}
      <div aria-live="polite">
        {input ? (
          <div className="scenarios">
            <ScenarioPanel strategy="reduceTerm" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
            <ScenarioPanel strategy="reduceInstallment" input={input} commissionRatePct={commissionRatePct} dict={dict} locale={locale} />
          </div>
        ) : Object.keys(errors).length === 0 ? (
          // Only for the incomplete (blank-field) state: when a field has an
          // error, "fill in the fields above" would contradict the visible
          // field-level alert, so the alert stands alone.
          <p className="calculator-empty">{dict.form.fillPrompt}</p>
        ) : null}
      </div>
    </div>
  );
}
