import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://asn-pfeil-phoenix.vercel.app',
  output: 'hybrid',
  adapter: vercel(),
  integrations: [mdx()],
  image: {
    domains: ['images.pexels.com', 'upload.wikimedia.org', 'mzm.klubkasse.de'],
    remotePatterns: [{ protocol: 'https' }],
  },
  markdown: {
    shikiConfig: { theme: 'github-dark' },
    allowDangerousHTML: true,
  }
});