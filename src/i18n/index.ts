import type { Locale } from '../lib/format';
import type { Dict } from './types';
import { pt } from './pt';
import { en } from './en';

export type { Dict, FaqItem } from './types';

export const dicts: Record<Locale, Dict> = { pt, en };

/** Substitute `{key}` placeholders in a translated string. */
export function tpl(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
