import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import publicationAssets from './src/integrations/publication-assets.mjs';
import remarkPublication from './src/plugins/remark-publication.mjs';

export default defineConfig({
  site: 'https://research.zenseact.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [publicationAssets(), sitemap()],
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['math'] },
    shikiConfig: { theme: 'github-light', wrap: true },
    processor: unified({
      // Same dash convention the Jekyll site used: -- is an en dash, --- an em dash.
      smartypants: { dashes: 'oldschool' },
      remarkPlugins: [remarkPublication, remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false, throwOnError: false }]],
    }),
  },
});
