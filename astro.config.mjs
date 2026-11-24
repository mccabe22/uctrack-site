import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://www.uctrack.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Stories keep WordPress's own typography; don't re-curl quotes.
  markdown: { smartypants: false },
});
