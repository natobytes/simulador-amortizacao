import { describe, it, expect } from 'vitest';
import { dicts, tpl } from './index';

describe('i18n', () => {
  it('exposes pt and en dictionaries', () => {
    expect(dicts.pt.meta.title).toContain('Amortização');
    expect(dicts.en.meta.title).toContain('Mortgage');
  });
  it('both locales have the same FAQ count', () => {
    expect(dicts.pt.faq.items.length).toBe(dicts.en.faq.items.length);
    expect(dicts.pt.faq.items.length).toBeGreaterThanOrEqual(6);
  });
  it('tpl substitutes placeholders', () => {
    expect(tpl('Poupas {amount} em juros', { amount: '100 €' })).toBe('Poupas 100 € em juros');
  });
  it('tpl leaves unknown placeholders intact', () => {
    expect(tpl('Poupas {amount} em {unit}', { amount: '100 €' })).toBe('Poupas 100 € em {unit}');
  });
  it('no empty strings in pt or en dictionaries', () => {
    const allStrings = (obj: unknown): string[] =>
      typeof obj === 'string' ? [obj] : Object.values(obj as object).flatMap(allStrings);
    expect(allStrings(dicts.pt).every((s) => s.length > 0)).toBe(true);
    expect(allStrings(dicts.en).every((s) => s.length > 0)).toBe(true);
  });
});
