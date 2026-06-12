export type Locale = 'pt' | 'en';

const INTL: Record<Locale, string> = { pt: 'pt-PT', en: 'en-IE' };

/**
 * Some ICU versions emit narrow no-break space (U+202F) as the group/currency
 * separator. Normalize Intl-emitted output to NBSP so server-rendered HTML and
 * client hydration always produce byte-identical strings (React 19 hydration
 * determinism). U+202F (narrow NBSP) -> U+00A0 (NBSP).
 * Only ever applied to Intl output — never to the U+202F group separators we
 * insert ourselves in groupThinSpaces() (those must stay U+202F), which is why
 * render() normalizes per part BEFORE inserting group separators.
 */
const nbsp = (s: string): string => s.replace(/\u202F/g, '\u00A0');

// Intl.NumberFormat construction is expensive; cache instances per
// locale+options since these run on every keystroke in a re-rendering island.
const formatterCache = new Map<string, Intl.NumberFormat>();
function getFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(INTL[locale], options);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Insert thin-space thousands separators into a bare digit run
 * ("150000" -> "150 000"): user-preferred thin-space grouping per
 * 3 digits, U+202F (NARROW NO-BREAK SPACE), inserted manually for hydration
 * determinism (see render()).
 */
const groupThinSpaces = (digits: string): string => digits.replace(/\B(?=(\d{3})+$)/g, '\u202F');

/**
 * pt deliberately deviates from raw pt-PT Intl output: CLDR groups with a
 * (narrow) NBSP and, because minimumGroupingDigits=2, omits grouping below
 * 10 000 ("1234,56"). The site spec is thin-space (U+202F) grouping from
 * 1 000 up ("1 234,56 €", "150 000,00 €"), so we disable Intl grouping and
 * insert the separators ourselves via formatToParts — deterministic across
 * ICU versions AND engines without Intl.NumberFormat v3 (Chrome <=105,
 * Safari <=15.3, Firefox <=115), where the string option `useGrouping:
 * 'always'` would coerce to plain `true` and silently fall back to min2
 * grouping, breaking SSR/client byte-identity for 1 000–9 999. It keeps
 * pt-PT currency placement (value, NBSP, €) and sign placement.
 * nbsp() runs per part BEFORE the group separators are inserted, so the
 * currency spacer normalizes to U+00A0 while the group separators stay U+202F
 * (the integer part is bare digits, untouched by nbsp()).
 * en renders through plain format() and is untouched.
 */
function render(value: number, locale: Locale, options: Intl.NumberFormatOptions): string {
  if (locale === 'pt') {
    const parts = getFormatter(locale, { ...options, useGrouping: false }).formatToParts(value);
    return parts.map((p) => (p.type === 'integer' ? groupThinSpaces(p.value) : nbsp(p.value))).join('');
  }
  return nbsp(getFormatter(locale, options).format(value));
}

export function formatEuro(value: number, locale: Locale): string {
  return render(value, locale, { style: 'currency', currency: 'EUR' });
}

export function formatSignedEuro(value: number, locale: Locale): string {
  return render(value, locale, {
    style: 'currency',
    currency: 'EUR',
    signDisplay: 'exceptZero',
  });
}

export function formatInt(value: number, locale: Locale): string {
  return render(value, locale, { maximumFractionDigits: 0 });
}

export function formatSignedInt(value: number, locale: Locale): string {
  return render(value, locale, {
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  });
}

export interface DurationDict {
  year: string;
  years: string;
  month: string;
  months: string;
  joiner: string;
}

/**
 * Render a month count as a human duration: "6 anos e 2 meses" / "2 years 2 months".
 * Uses the absolute value (the caller renders the sign separately) and omits
 * the months part when the remainder is zero ("2 anos"). Fractional inputs are
 * rounded to the nearest whole month so `% 12` never leaks float noise into copy.
 */
export function formatYearsMonths(months: number, d: DurationDict): string {
  const abs = Math.round(Math.abs(months));
  const years = Math.floor(abs / 12);
  const rem = abs % 12;
  const yearPart = years > 0 ? `${years} ${years === 1 ? d.year : d.years}` : '';
  const monthPart = rem > 0 ? `${rem} ${rem === 1 ? d.month : d.months}` : '';
  if (yearPart && monthPart) return yearPart + d.joiner + monthPart;
  return yearPart || monthPart;
}

/**
 * Reformat a raw form-input string with the locale's digit grouping on blur
 * (pt: '194616,84' -> '194\u202f616,84'; en: '194616.84' -> '194,616.84').
 * Unparseable or blank input is returned unchanged (the field error / blank
 * state stays visible), and the fraction is taken verbatim from
 * String(parseNumber(...)), so the round-trip guarantee holds:
 * parseNumber(formatInputValue(s, l), l) === parseNumber(s, l) for parseable s.
 */
export function formatInputValue(raw: string, locale: Locale): string {
  const value = parseNumber(raw, locale);
  if (value === null) return raw; // blank or invalid: leave as typed
  const canonical = String(value);
  // Defensive: exponent notation can't be regrouped digit-wise. Validated
  // inputs never reach magnitudes where String() emits it.
  if (canonical.includes('e') || canonical.includes('E')) return raw;
  const sign = canonical.startsWith('-') ? '-' : '';
  const [intDigits, fraction] = (sign ? canonical.slice(1) : canonical).split('.');
  const grouped =
    locale === 'pt' ? groupThinSpaces(intDigits) : intDigits.replace(/\B(?=(\d{3})+$)/g, ',');
  const decimalSep = locale === 'pt' ? ',' : '.';
  return sign + grouped + (fraction !== undefined ? decimalSep + fraction : '');
}

/**
 * Parse user input per locale convention.
 * pt: comma is decimal; a dot followed by exactly 3 digits is grouping ("1.234"),
 *     otherwise the dot is treated as a decimal typo ("3.5" -> 3.5).
 * en: dot is decimal; a comma followed by 1-2 digits is treated as a continental
 *     decimal ("1,5" -> 1.5), otherwise commas are grouping.
 */
export function parseNumber(input: string, locale: Locale): number | null {
  // Strip whitespace (incl. U+202F / U+00A0), euro sign and percent sign.
  let s = input.trim().replace(/[\s\u202F\u00A0€%]/g, '');
  if (s === '') return null;
  if (/[,.]{2,}/.test(s)) return null; // consecutive separators ("1,,2", "1..2") are garbage
  // The signed formatters emit a leading sign ("-12.000", "+1.234,56 €");
  // detach it so the digit-anchored separator heuristics below still apply,
  // then re-attach for the final parse ('+' normalizes away).
  const sign = s.startsWith('-') ? '-' : '';
  s = s.replace(/^[-+]/, '');
  if (locale === 'pt') {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(',', '.');
    }
  } else {
    if (/^\d+,\d{1,2}$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  if ((s.match(/\./g) ?? []).length > 1) return null;
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const value = Number(sign + s);
  return Number.isFinite(value) ? value : null;
}
