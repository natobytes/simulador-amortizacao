import { useLayoutEffect, useRef, type ChangeEvent } from 'react';
import type { Dict } from '../i18n';
import type { FieldErrors, FieldKey, Frequency } from '../lib/amortizacao';
import { formatInputValue, groupAsTyped, type Locale } from '../lib/format';

export type CommissionPreset = 'none' | 'variable' | 'fixed' | 'custom';

export interface FormState {
  capital: string;
  installments: string;
  rate: string;
  amortization: string;
  frequency: Frequency;
  commissionPreset: CommissionPreset;
  customCommission: string;
}

interface Props {
  form: FormState;
  errors: FieldErrors;
  dict: Dict;
  locale: Locale;
  onChange: (next: FormState) => void;
}

interface FieldDef {
  key: keyof Pick<FormState, 'capital' | 'installments' | 'rate' | 'amortization'>;
  errorKey: FieldKey;
  label: string;
  suffix: string;
  inputMode: 'decimal' | 'numeric';
}

export default function InputForm({ form, errors, dict, locale, onChange }: Props) {
  const fields: FieldDef[] = [
    { key: 'capital', errorKey: 'capital', label: dict.form.capital, suffix: '€', inputMode: 'decimal' },
    { key: 'installments', errorKey: 'installments', label: dict.form.installments, suffix: '', inputMode: 'numeric' },
    { key: 'rate', errorKey: 'rate', label: dict.form.rate, suffix: '%', inputMode: 'decimal' },
    { key: 'amortization', errorKey: 'amortization', label: dict.form.amortization, suffix: '€', inputMode: 'decimal' },
  ];

  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });

  // Live regrouping rewrites the input's value mid-keystroke; React resets the
  // caret to the end of a controlled input whenever the committed value differs
  // from the DOM value, so groupAsTyped's remapped caret is stashed here and
  // restored after the commit.
  const pendingCaret = useRef<{ id: string; caret: number } | null>(null);

  // useLayoutEffect runs after the controlled value commits to the DOM but
  // before paint, so the caret never visibly jumps. No dep array: it must run
  // after every render, and it no-ops unless a caret restore is pending.
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pendingCaret.current = null;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el.id === pending.id) {
      try {
        el.setSelectionRange(pending.caret, pending.caret);
      } catch {
        // Some mobile browsers throw on detached nodes; losing the caret
        // position is the acceptable fallback.
      }
    }
  });

  // Shared onChange path for all numeric text inputs: live-regroup the typed
  // value (caret-safe; groupAsTyped returns the raw string unchanged for
  // anything ambiguous) and remember where the caret belongs when the string
  // was rewritten.
  const handleNumericChange = (
    e: ChangeEvent<HTMLInputElement>,
    prev: string,
    apply: (value: string) => void,
  ) => {
    const el = e.target;
    const res = groupAsTyped(el.value, el.selectionStart ?? el.value.length, locale);
    let caret = res.caret;
    // Forward-Delete of a group separator is absorbed by the regroup: the
    // separator is re-inserted and the caret maps back to the exact
    // pre-keypress position, which would make Delete a permanent no-op there
    // (Backspace is fine — its caret naturally ends up past the separator).
    // Detect the absorbed deletion (regrouped result identical to the
    // previously committed value on a forward delete) and advance the caret
    // past the re-inserted separator so the next Delete reaches the digit
    // behind it, mirroring Backspace's absorb-then-progress behavior. Only a
    // separator-only deletion can regroup back to the previous value (any
    // digit/sign/decimal deletion changes it), so this cannot misfire on
    // digit deletions that merely land the caret next to a separator.
    if (
      res.value === prev &&
      (e.nativeEvent as InputEvent).inputType === 'deleteContentForward'
    ) {
      caret = Math.min(caret + 1, res.value.length);
    }
    apply(res.value);
    if (res.value !== el.value) pendingCaret.current = { id: el.id, caret };
  };

  return (
    <form className="input-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>{dict.form.legend}</legend>
        <div className="form-grid">
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
                  onChange={(e) =>
                    handleNumericChange(e, form[f.key], (value) => onChange({ ...form, [f.key]: value }))
                  }
                  onBlur={(e) => {
                    // Only dispatch when the reformat actually changes the
                    // string: a new FormState identity restarts the 250ms
                    // debounce (postponing any pending error/result update)
                    // and re-runs the parse/simulate/persist pipeline.
                    const next = formatInputValue(e.target.value, locale);
                    if (next !== e.target.value) onChange({ ...form, [f.key]: next });
                  }}
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
                aria-describedby={errors.commission ? 'customCommission-error' : undefined}
                onChange={(e) =>
                  handleNumericChange(e, form.customCommission, (value) => set({ customCommission: value }))
                }
                onBlur={(e) => {
                  // Same no-op guard as the generic fields above.
                  const next = formatInputValue(e.target.value, locale);
                  if (next !== e.target.value) set({ customCommission: next });
                }}
              />
              <span className="suffix" aria-hidden="true">%</span>
            </div>
            {errors.commission && (
              <p className="field-error" id="customCommission-error" role="alert">{dict.form.errors[errors.commission]}</p>
            )}
          </div>
        )}
        </div>
      </fieldset>
    </form>
  );
}
