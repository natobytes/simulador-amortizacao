import { describe, it, expect } from 'vitest';
import { formatEuro, formatSignedEuro, formatInt, formatSignedInt, formatYearsMonths, formatInputValue, groupAsTyped, parseNumber } from './format';
import type { Locale } from './format';
import { dicts } from '../i18n';

// Intl grouping/space characters vary (NBSP vs narrow NBSP); normalize for assertions.
const norm = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

describe('formatEuro', () => {
  it('pt: comma decimals, thin-space grouping from 1000 up, € suffix', () => {
    // Deliberate deviation from raw pt-PT Intl (which omits grouping below
    // 10 000): the site spec is thin-space grouping from 1 000 up ("1 234,56 €").
    expect(norm(formatEuro(1234.56, 'pt'))).toBe('1 234,56 €');
    expect(norm(formatEuro(150000, 'pt'))).toBe('150 000,00 €');
    expect(norm(formatEuro(673.57, 'pt'))).toBe('673,57 €');
  });
  it('en: dot decimals, € prefix', () => {
    expect(norm(formatEuro(1234.56, 'en'))).toMatch(/^€ ?1,234\.56$/);
  });
  it('en: exact bytes — unchanged by the pt thin-space grouping', () => {
    expect(formatEuro(1234.56, 'en')).toBe('€1,234.56');
    expect(formatSignedEuro(29.16, 'en')).toBe('+€29.16');
  });
  it('pt: exact bytes — U+202F group separator, NBSP (U+00A0) before €', () => {
    // Pins the byte contract React 19 hydration determinism relies on: the
    // manually inserted group separators stay narrow NBSP (U+202F) while the
    // currency spacer is normalized to NBSP (U+00A0) by nbsp(); every other
    // assertion norm()s both away.
    expect(formatEuro(1234.56, 'pt')).toBe('1\u202f234,56\u00a0€');
    expect(formatEuro(150000, 'pt')).toBe('150\u202f000,00\u00a0€');
    expect(formatSignedEuro(-1234.56, 'pt')).toBe('-1\u202f234,56\u00a0€');
  });
});

describe('signed formats (Diferença column)', () => {
  it('shows explicit sign except zero', () => {
    expect(norm(formatSignedEuro(-29.17, 'pt'))).toMatch(/^-29,17 €$/);
    expect(norm(formatSignedEuro(29.16, 'pt'))).toMatch(/^\+29,16 €$/);
    expect(norm(formatSignedEuro(29.16, 'en'))).toMatch(/^\+€ ?29\.16$/);
    expect(formatSignedInt(-40, 'pt')).toBe('-40');
    expect(formatSignedInt(0, 'pt')).toBe('0');
  });
  it('pt: keeps sign placement with thin-space grouping', () => {
    expect(norm(formatSignedEuro(-1234.56, 'pt'))).toBe('-1 234,56 €');
    expect(norm(formatSignedEuro(1234.56, 'pt'))).toBe('+1 234,56 €');
    expect(formatSignedInt(-12000, 'pt')).toBe('-12\u202f000');
  });
});

describe('formatInt', () => {
  it('formats whole numbers', () => {
    expect(formatInt(360, 'pt')).toBe('360');
    expect(formatInt(12000, 'pt')).toBe('12\u202f000');
  });
});

describe('formatYearsMonths', () => {
  const pt = { year: 'ano', years: 'anos', month: 'mês', months: 'meses', joiner: ' e ' };
  const en = { year: 'year', years: 'years', month: 'month', months: 'months', joiner: ' ' };
  it('pt: pluralizes and omits zero remainders', () => {
    expect(formatYearsMonths(12, pt)).toBe('1 ano');
    expect(formatYearsMonths(24, pt)).toBe('2 anos');
    expect(formatYearsMonths(26, pt)).toBe('2 anos e 2 meses');
    expect(formatYearsMonths(13, pt)).toBe('1 ano e 1 mês');
  });
  it('uses the absolute value of negative inputs', () => {
    expect(formatYearsMonths(-74, pt)).toBe('6 anos e 2 meses');
    expect(formatYearsMonths(-24, en)).toBe('2 years');
  });
  it('en: space joiner, no "and"', () => {
    expect(formatYearsMonths(12, en)).toBe('1 year');
    expect(formatYearsMonths(26, en)).toBe('2 years 2 months');
    expect(formatYearsMonths(13, en)).toBe('1 year 1 month');
  });
  it('real dictionaries: joiner whitespace is load-bearing', () => {
    // Pins dicts.*.cards.duration itself — the inline copies above would stay
    // green if a cleanup trimmed pt's ' e ' to 'e' ("6 anos e2 meses").
    expect(formatYearsMonths(74, dicts.pt.cards.duration)).toBe('6 anos e 2 meses');
    expect(formatYearsMonths(26, dicts.en.cards.duration)).toBe('2 years 2 months');
  });
  it('rounds fractional months instead of leaking float noise', () => {
    expect(formatYearsMonths(13.7, pt)).toBe('1 ano e 2 meses');
  });
});

describe('formatInputValue', () => {
  it('pt: thin-space (U+202F) grouping, comma decimal', () => {
    expect(formatInputValue('194616,84', 'pt')).toBe('194\u202f616,84');
    expect(formatInputValue('150.000', 'pt')).toBe('150\u202f000'); // typed dot grouping canonicalized
    expect(formatInputValue('3,5', 'pt')).toBe('3,5');
    expect(formatInputValue('360', 'pt')).toBe('360');
  });
  it('pt: never rounds typed decimals (simulation input must display exactly)', () => {
    expect(formatInputValue('3,275', 'pt')).toBe('3,275');
  });
  it('en: comma grouping, dot decimal', () => {
    expect(formatInputValue('194616.84', 'en')).toBe('194,616.84');
    expect(formatInputValue('1,5', 'en')).toBe('1.5'); // continental decimal canonicalized
  });
  it('leaves blank and unparseable input unchanged', () => {
    expect(formatInputValue('', 'pt')).toBe('');
    expect(formatInputValue('abc', 'pt')).toBe('abc');
    expect(formatInputValue('1..2', 'pt')).toBe('1..2');
  });
  it('preserves a leading minus', () => {
    expect(formatInputValue('-5', 'pt')).toBe('-5');
  });
  it('round-trips through parseNumber in both locales', () => {
    const inputs: Record<Locale, string[]> = {
      pt: ['194616,84', '150.000', '3,5', '3,275', '360', '-5', '1.234,56', '150 000', '194616,80', '0,5'],
      en: ['194616.84', '150,000', '3.5', '3.275', '360', '-5', '1,234.56', '1,5', '.5'],
    };
    for (const locale of ['pt', 'en'] as const) {
      for (const x of inputs[locale]) {
        expect(parseNumber(formatInputValue(x, locale), locale)).toBe(parseNumber(x, locale));
      }
    }
  });
  it('canonicalizes legacy stored values (restore path)', () => {
    // Calculator's restore effect feeds localStorage strings through
    // formatInputValue: a legacy pt entry typed with a decimal dot comes back
    // in canonical comma form.
    expect(formatInputValue('2.65', 'pt')).toBe('2,65');
  });
});

describe('groupAsTyped', () => {
  it('pt: groups live at end-of-field caret', () => {
    expect(groupAsTyped('1234', 4, 'pt')).toEqual({ value: '1\u202f234', caret: 5 });
    expect(groupAsTyped('194616', 6, 'pt')).toEqual({ value: '194\u202f616', caret: 7 });
    // Already grouped: stable, caret untouched.
    expect(groupAsTyped('194\u202f616,84', 10, 'pt')).toEqual({ value: '194\u202f616,84', caret: 10 });
    // Trailing decimal comma is kept verbatim.
    expect(groupAsTyped('194616,', 7, 'pt')).toEqual({ value: '194\u202f616,', caret: 8 });
  });
  it('pt: mid-string insertion keeps the caret after the typed digit', () => {
    // '1\u202f234' with '5' typed at index 1 -> raw '15\u202f234', caret 2;
    // grouping is already canonical, caret stays right after the '5'.
    expect(groupAsTyped('15\u202f234', 2, 'pt')).toEqual({ value: '15\u202f234', caret: 2 });
    // '123\u202f456' with '9' typed at index 2 -> raw '1293\u202f456', caret 3;
    // regroups to '1\u202f293\u202f456' with the caret still after the '9'
    // (3 significant chars in, which lands at index 4 past the new separator).
    expect(groupAsTyped('1293\u202f456', 3, 'pt')).toEqual({ value: '1\u202f293\u202f456', caret: 4 });
  });
  it('pt: deleting a group separator regroups and keeps the caret', () => {
    // User deleted the thin space from '194\u202f616' (raw '194616', caret 3):
    // the separator is restored and the caret stays before it.
    expect(groupAsTyped('194616', 3, 'pt')).toEqual({ value: '194\u202f616', caret: 3 });
  });
  it('guard: ambiguous or foreign-separator input is left alone while typing', () => {
    expect(groupAsTyped('1.5', 3, 'pt')).toEqual({ value: '1.5', caret: 3 }); // dot is foreign on pt
    expect(groupAsTyped('1.234', 5, 'pt')).toEqual({ value: '1.234', caret: 5 }); // dot is ambiguous
    expect(groupAsTyped('1,234', 5, 'en')).toEqual({ value: '1,234', caret: 5 }); // already grouped: stable
    expect(groupAsTyped('1.5', 3, 'en')).toEqual({ value: '1.5', caret: 3 }); // <= 3 int digits: no change
    // Space is a foreign (pt-style) separator on en: left alone until blur,
    // never half-regrouped into mixed space+comma output ('1 2,345,678').
    expect(groupAsTyped('1 2345678', 9, 'en')).toEqual({ value: '1 2345678', caret: 9 });
    expect(groupAsTyped('12 345', 6, 'en')).toEqual({ value: '12 345', caret: 6 });
    expect(groupAsTyped('abc', 3, 'pt')).toEqual({ value: 'abc', caret: 3 });
    expect(groupAsTyped('', 0, 'pt')).toEqual({ value: '', caret: 0 });
    expect(groupAsTyped('-', 1, 'pt')).toEqual({ value: '-', caret: 1 });
  });
  it('en: comma grouping; pt: sign survives grouping', () => {
    expect(groupAsTyped('1234.5', 6, 'en')).toEqual({ value: '1,234.5', caret: 7 });
    expect(groupAsTyped('-1234', 5, 'pt')).toEqual({ value: '-1\u202f234', caret: 6 });
  });
  it('never changes the parsed value (separator-only edits)', () => {
    const samples: Record<Locale, string[]> = {
      pt: [
        '', '-', 'abc', '1.5', '1.234', '194616,84', '194616,', '150 000', '0,5', '-1234',
        '12,34', '1234567', '1\u202f234,56',
        formatEuro(1234.56, 'pt'), formatSignedEuro(-1234.56, 'pt'),
        formatInt(12000, 'pt'), formatSignedInt(-12000, 'pt'),
        formatInputValue('194616,84', 'pt'),
      ],
      en: [
        '', '-', 'abc', '1,234', '12,34', '1,5', '1,', '1234.5', '1234567.89', '.5', '-1234',
        formatEuro(1234.56, 'en'), formatSignedEuro(29.16, 'en'),
        formatInt(12000, 'en'), formatSignedInt(-12000, 'en'),
        formatInputValue('194616.84', 'en'),
      ],
    };
    for (const locale of ['pt', 'en'] as const) {
      for (const s of samples[locale]) {
        expect(parseNumber(groupAsTyped(s, 0, locale).value, locale)).toBe(parseNumber(s, locale));
      }
    }
  });
});

describe('parseNumber', () => {
  it('pt: comma decimal, dot/space grouping', () => {
    expect(parseNumber('3,5', 'pt')).toBe(3.5);
    expect(parseNumber('1.234,56', 'pt')).toBe(1234.56);
    expect(parseNumber('1.234', 'pt')).toBe(1234); // dot followed by 3 digits = grouping
    expect(parseNumber('1.5', 'pt')).toBe(1.5); // dot not followed by 3 digits = decimal
    expect(parseNumber('150 000', 'pt')).toBe(150000);
  });
  it('en: dot decimal, comma grouping', () => {
    expect(parseNumber('3.5', 'en')).toBe(3.5);
    expect(parseNumber('1,234.56', 'en')).toBe(1234.56);
    expect(parseNumber('1,234', 'en')).toBe(1234);
    expect(parseNumber('1,5', 'en')).toBe(1.5); // continental habit: comma + 1-2 digits = decimal
  });
  it('tolerates pasted symbols and bare leading dot', () => {
    expect(parseNumber('10 000 €', 'pt')).toBe(10000);
    expect(parseNumber('3,5 %', 'pt')).toBe(3.5);
    expect(parseNumber('.5', 'en')).toBe(0.5);
    // Negative values parse; range rejection (e.g. amounts must be > 0) is validate()'s job.
    expect(parseNumber('-5', 'pt')).toBe(-5);
  });
  it('round-trips the pt thin-space-grouped display format', () => {
    // U+202F is stripped up front, so the grouped output re-parses through the
    // non-grouped branch ('1 234,56' -> '1234,56' -> 1234.56).
    expect(parseNumber('1\u202f234,56', 'pt')).toBe(1234.56);
    expect(parseNumber('150\u202f000', 'pt')).toBe(150000);
    expect(parseNumber(formatInt(150000, 'pt'), 'pt')).toBe(150000);
    expect(parseNumber(formatEuro(1234.56, 'pt'), 'pt')).toBe(1234.56);
    expect(parseNumber('150.000', 'pt')).toBe(150000); // typed dot grouping still accepted
  });
  it('round-trips the signed display formats (leading sign + grouping)', () => {
    expect(parseNumber(formatSignedInt(-12000, 'pt'), 'pt')).toBe(-12000);
    expect(parseNumber(formatSignedEuro(-1234.56, 'pt'), 'pt')).toBe(-1234.56);
    expect(parseNumber(formatSignedEuro(1234.56, 'pt'), 'pt')).toBe(1234.56);
    expect(parseNumber(formatSignedEuro(-1234.56, 'en'), 'en')).toBe(-1234.56);
    expect(parseNumber('-1,5', 'en')).toBe(-1.5); // signed continental decimal
  });
  it('rejects garbage and empties', () => {
    expect(parseNumber('', 'pt')).toBeNull();
    expect(parseNumber('abc', 'pt')).toBeNull();
    expect(parseNumber('12abc', 'en')).toBeNull();
    expect(parseNumber('1,,2', 'en')).toBeNull();
    expect(parseNumber('1..2', 'pt')).toBeNull();
  });
});
