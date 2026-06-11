import { describe, it, expect } from 'vitest';
import { formatEuro, formatSignedEuro, formatInt, formatSignedInt, parseNumber } from './format';

// Intl grouping/space characters vary (NBSP vs narrow NBSP); normalize for assertions.
const norm = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

describe('formatEuro', () => {
  it('pt: comma decimals, € suffix', () => {
    // pt-PT CLDR has minimumGroupingDigits=2: NO group separator below 10 000.
    expect(norm(formatEuro(1234.56, 'pt'))).toBe('1234,56 €');
    expect(norm(formatEuro(150000, 'pt'))).toMatch(/^150 000,00 €$/);
    expect(norm(formatEuro(673.57, 'pt'))).toBe('673,57 €');
  });
  it('en: dot decimals, € prefix', () => {
    expect(norm(formatEuro(1234.56, 'en'))).toMatch(/^€ ?1,234\.56$/);
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
});

describe('formatInt', () => {
  it('formats whole numbers', () => {
    expect(formatInt(360, 'pt')).toBe('360');
    expect(norm(formatInt(12000, 'pt'))).toBe('12 000');
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
  it('rejects garbage and empties', () => {
    expect(parseNumber('', 'pt')).toBeNull();
    expect(parseNumber('abc', 'pt')).toBeNull();
    expect(parseNumber('12abc', 'en')).toBeNull();
    expect(parseNumber('1,,2', 'en')).toBeNull();
    expect(parseNumber('1..2', 'pt')).toBeNull();
  });
});
