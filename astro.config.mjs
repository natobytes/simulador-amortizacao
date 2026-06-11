import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://natobytes.com',
  base: '/simulador-amortizacao',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'pt',
    locales: ['pt', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // sitemap() intentionally has NO i18n option: the HTML <link> hreflang tags in
  // Base.astro are the single source of hreflang truth (spec §6). Do not "fix" this.
  integrations: [react(), sitemap()],
});
