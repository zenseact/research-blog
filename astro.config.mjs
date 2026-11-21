import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import publicationAssets from './src/integrations/publication-assets.mjs';
import rehypeLayout from './src/plugins/rehype-layout.mjs';
import remarkPublication from './src/plugins/remark-publication.mjs';

export default defineConfig({
  site: 'https://research.zenseact.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [publicationAssets(), sitemap()],
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['math'] },
    shikiConfig: { theme: 'github-light' },
    processor: unified({
      // Same dash convention the Jekyll site used: -- is an en dash, --- an em dash.
      smartypants: { dashes: 'oldschool' },
      remarkPlugins: [remarkPublication, remarkMath],
      // rehypeRaw parses the HTML written in posts so that rehypeLayout can see it.
      rehypePlugins: [rehypeRaw, [rehypeKatex, { strict: false, throwOnError: false }], rehypeLayout],
    }),
  },
});
