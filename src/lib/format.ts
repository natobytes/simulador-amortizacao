export type Locale = 'pt' | 'en';

const INTL: Record<Locale, string> = { pt: 'pt-PT', en: 'en-IE' };

/**
 * Some ICU versions emit narrow no-break space (U+202F) as the group/currency
 * separator. Normalize to NBSP so server-rendered HTML and client hydration
 * always produce byte-identical strings (React 19 hydration determinism).
 * U+202F (narrow NBSP) -> U+00A0 (NBSP).
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

export function formatEuro(value: number, locale: Locale): string {
  return nbsp(getFormatter(locale, { style: 'currency', currency: 'EUR' }).format(value));
}

export function formatSignedEuro(value: number, locale: Locale): string {
  return nbsp(
    getFormatter(locale, {
      style: 'currency',
      currency: 'EUR',
      signDisplay: 'exceptZero',
    }).format(value),
  );
}

export function formatInt(value: number, locale: Locale): string {
  return nbsp(getFormatter(locale, { maximumFractionDigits: 0 }).format(value));
}

export function formatSignedInt(value: number, locale: Locale): string {
  return nbsp(
    getFormatter(locale, {
      maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    }).format(value),
  );
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
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}
