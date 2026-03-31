import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://asn-pfeil-phoenix.vercel.app',
  integrations: [mdx()],
  markdown: {
    shikiConfig: { theme: 'github-dark' }
  }
});
