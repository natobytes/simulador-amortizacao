export type Locale = 'pt' | 'en';

const INTL: Record<Locale, string> = { pt: 'pt-PT', en: 'en-IE' };

/**
 * Some ICU versions emit narrow no-break space (U+202F) as the group/currency
 * separator. Normalize to NBSP so server-rendered HTML and client hydration
 * always produce byte-identical strings (React 19 hydration determinism).
 */
const nbsp = (s: string): string => s.replace(/ /g, ' ');

export function formatEuro(value: number, locale: Locale): string {
  return nbsp(new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'EUR' }).format(value));
}

export function formatSignedEuro(value: number, locale: Locale): string {
  return nbsp(
    new Intl.NumberFormat(INTL[locale], {
      style: 'currency',
      currency: 'EUR',
      signDisplay: 'exceptZero',
    }).format(value),
  );
}

export function formatInt(value: number, locale: Locale): string {
  return nbsp(new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 0 }).format(value));
}

export function formatSignedInt(value: number, locale: Locale): string {
  return nbsp(
    new Intl.NumberFormat(INTL[locale], {
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
  let s = input.trim().replace(/[\s  €%]/g, '');
  if (s === '') return null;
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
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}
