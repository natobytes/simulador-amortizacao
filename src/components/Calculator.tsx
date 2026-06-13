import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dict } from '../i18n';
import type { Frequency, RawInput, SimulationInput } from '../lib/amortizacao';
import { validate } from '../lib/amortizacao';
import type { Locale } from '../lib/format';
import { formatInputValue, parseNumber } from '../lib/format';
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
    frequency: 'once',
    commissionPreset: 'none',
    customCommission: '',
  };
}

// Namespaced per locale: the stored values are form strings in that locale's
// conventions — live-grouped/blur-canonicalized, or raw only when the typed
// string was ambiguous or unparseable (e.g. a pt '150.000' saved mid-typing) —
// and parseNumber's separator heuristics are locale-branched: restoring that
// pt '150.000' on the en page would silently reparse as 150 (and vice versa
// for en ','-grouping on pt).
function storageKey(locale: Locale): string {
  return `simulador-amortizacao:form:${locale}:v1`;
}

const COMMISSION_PRESET_VALUES: readonly string[] = ['none', 'variable', 'fixed', 'custom'];
const FREQUENCY_VALUES: readonly string[] = ['once', 'yearly', 'biennial'];

/**
 * Shape-check a value read back from localStorage. The six original FormState
 * fields must be strings and commissionPreset a known preset. `frequency` was
 * added later, so it is NOT required here (v1 entries written before this feature
 * lack it) — the restore step defaults it. Anything else is ignored.
 */
function isStoredForm(value: unknown): value is Omit<FormState, 'frequency'> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.capital === 'string' &&
    typeof v.installments === 'string' &&
    typeof v.rate === 'string' &&
    typeof v.amortization === 'string' &&
    typeof v.customCommission === 'string' &&
    typeof v.commissionPreset === 'string' &&
    COMMISSION_PRESET_VALUES.includes(v.commissionPreset)
  );
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
          frequency: form.frequency,
        }
      : null,
    errors,
    commissionRatePct: commissionRatePct ?? 0,
  };
}

export default function Calculator({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [debounced, setDebouncedNow] = useDebounced(form, 250);
  const { input, errors, commissionRatePct } = useMemo(
    () => parseForm(debounced, locale),
    [debounced, locale],
  );

  // localStorage persistence. The island is SSR'd and hydrated by React 19,
  // so storage is never touched during render or in a state initializer
  // (server/client mismatch); restore happens in a mount effect instead.
  const restoreDone = useRef(false);

  // Save effect — declared BEFORE the restore effect so its mount run sees
  // restoreDone.current === false and skips (effects run in declaration order
  // on mount). The restore effect's cleanup resets the flag, so a remount
  // (e.g. StrictMode's double-invocation) replays the same skip-then-restore
  // sequence instead of overwriting storage with the empty initial form.
  // Saving on the debounced form avoids a write per keystroke.
  useEffect(() => {
    if (!restoreDone.current) return;
    try {
      window.localStorage.setItem(
        storageKey(locale),
        JSON.stringify({
          capital: debounced.capital,
          installments: debounced.installments,
          rate: debounced.rate,
          amortization: debounced.amortization,
          frequency: debounced.frequency,
          commissionPreset: debounced.commissionPreset,
          customCommission: debounced.customCommission,
        }),
      );
    } catch {
      // Private mode / disabled or full storage: persistence is best-effort.
    }
  }, [debounced, locale]);

  // Restore effect: runs once on mount (locale is fixed per page), then
  // unblocks saving (even when nothing was stored or the stored value was
  // malformed).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(locale));
      if (raw !== null) {
        const stored: unknown = JSON.parse(raw);
        if (isStoredForm(stored)) {
          // Stored values are raw typed strings that never went through the
          // blur formatter; reformat on restore so fields render grouped
          // ('194616,84' -> grouped) and legacy entries are canonicalized
          // ('2.65' -> '2,65' on pt). Restored text is programmatic — no
          // caret concerns. Blank/unparseable strings pass through unchanged.
          // frequency is absent in v1 entries written before this field existed;
          // the cast lets us read it without widening isStoredForm's return type.
          // Validated against FREQUENCY_VALUES the same way commissionPreset is.
          const storedFreq = (stored as { frequency?: unknown }).frequency;
          const frequency: Frequency =
            typeof storedFreq === 'string' && FREQUENCY_VALUES.includes(storedFreq)
              ? (storedFreq as Frequency)
              : 'once';
          const restored: FormState = {
            capital: formatInputValue(stored.capital, locale),
            installments: formatInputValue(stored.installments, locale),
            rate: formatInputValue(stored.rate, locale),
            amortization: formatInputValue(stored.amortization, locale),
            frequency,
            commissionPreset: stored.commissionPreset,
            customCommission: formatInputValue(stored.customCommission, locale),
          };
          setForm(restored);
          // Bypass the debounce so fields and results fill in the same
          // commit — routing the restore through it would show the
          // fillPrompt under a visibly filled form for ~250ms.
          setDebouncedNow(restored);
        }
      }
    } catch {
      // Malformed JSON or unavailable storage: start from the empty form.
    }
    restoreDone.current = true;
    // Reset on cleanup so a remount (StrictMode double-invocation) replays
    // the skip-save-then-restore sequence against intact storage instead of
    // letting the save effect's second run see the flag set and clobber the
    // stored form with the still-empty `debounced`.
    return () => {
      restoreDone.current = false;
    };
  }, [locale, setDebouncedNow]);

  return (
    <div className="calculator">
      <InputForm form={form} errors={errors} dict={dict} locale={locale} onChange={setForm} />
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
