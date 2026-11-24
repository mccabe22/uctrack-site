import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://www.uctrack.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
