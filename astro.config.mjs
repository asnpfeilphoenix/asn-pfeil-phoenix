import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://asn-pfeil-phoenix.vercel.app',
  output: 'hybrid',
  adapter: vercel(),
  integrations: [mdx()],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
    allowDangerousHTML: true,
  }
});
