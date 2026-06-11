import type { Dict } from '../i18n';
import type { FieldErrors, FieldKey } from '../lib/amortizacao';

export type CommissionPreset = 'none' | 'variable' | 'fixed' | 'custom';

export interface FormState {
  capital: string;
  installments: string;
  rate: string;
  amortization: string;
  commissionPreset: CommissionPreset;
  customCommission: string;
}

interface Props {
  form: FormState;
  errors: FieldErrors;
  dict: Dict;
  onChange: (next: FormState) => void;
}

interface FieldDef {
  key: keyof Pick<FormState, 'capital' | 'installments' | 'rate' | 'amortization'>;
  errorKey: FieldKey;
  label: string;
  suffix: string;
  inputMode: 'decimal' | 'numeric';
}

export default function InputForm({ form, errors, dict, onChange }: Props) {
  const fields: FieldDef[] = [
    { key: 'capital', errorKey: 'capital', label: dict.form.capital, suffix: '€', inputMode: 'decimal' },
    { key: 'installments', errorKey: 'installments', label: dict.form.installments, suffix: '', inputMode: 'numeric' },
    { key: 'rate', errorKey: 'rate', label: dict.form.rate, suffix: '%', inputMode: 'decimal' },
    { key: 'amortization', errorKey: 'amortization', label: dict.form.amortization, suffix: '€', inputMode: 'decimal' },
  ];

  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });

  return (
    <form className="input-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>{dict.form.legend}</legend>
        {fields.map((f) => {
          const error = errors[f.errorKey];
          return (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <div className="field-input">
                <input
                  id={f.key}
                  data-testid={`input-${f.key}`}
                  type="text"
                  inputMode={f.inputMode}
                  autoComplete="off"
                  value={form[f.key]}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${f.key}-error` : undefined}
                  onChange={(e) => set({ [f.key]: e.target.value } as Partial<FormState>)}
                />
                {f.suffix && <span className="suffix" aria-hidden="true">{f.suffix}</span>}
              </div>
              {error && (
                <p className="field-error" id={`${f.key}-error`} role="alert">
                  {dict.form.errors[error]}
                </p>
              )}
            </div>
          );
        })}
        <div className="field">
          <label htmlFor="commission">{dict.form.commission}</label>
          <select
            id="commission"
            data-testid="input-commission"
            value={form.commissionPreset}
            onChange={(e) => set({ commissionPreset: e.target.value as CommissionPreset })}
          >
            <option value="none">{dict.form.commissionOptions.none}</option>
            <option value="variable">{dict.form.commissionOptions.variable}</option>
            <option value="fixed">{dict.form.commissionOptions.fixed}</option>
            <option value="custom">{dict.form.commissionOptions.custom}</option>
          </select>
          <p className="field-help">{dict.form.commissionHelp}</p>
        </div>
        {form.commissionPreset === 'custom' && (
          <div className="field">
            <label htmlFor="customCommission">{dict.form.customRate}</label>
            <div className="field-input">
              <input
                id="customCommission"
                data-testid="input-customCommission"
                type="text"
                inputMode="decimal"
                value={form.customCommission}
                aria-invalid={errors.commission ? true : undefined}
                onChange={(e) => set({ customCommission: e.target.value })}
              />
              <span className="suffix" aria-hidden="true">%</span>
            </div>
            {errors.commission && (
              <p className="field-error" role="alert">{dict.form.errors[errors.commission]}</p>
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}
