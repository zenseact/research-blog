// Checks the built site: every local src / href / poster in every HTML page
// must point at a file that exists in dist/. Run after `npm run build`.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const SITE = 'https://research.zenseact.com';
const ATTRIBUTE = /\s(?:src|href|poster|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_URL = /url\(\s*(?:&quot;|["'])?([^"')&]+)(?:&quot;|["'])?\s*\)/gi;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const exists = (file) =>
  fs.existsSync(file) && (fs.statSync(file).isFile() || fs.existsSync(path.join(file, 'index.html')));

let checked = 0;
const broken = [];
for (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  // Only pages rendered by Astro; demo/game HTML shipped inside a publication folder is left alone.
  const page = '/' + path.relative(dist, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, (tag) => tag.match(/^<script[^>]*>/)[0]);
  if (!html.includes('data-astro-') && !html.includes('site-header')) continue;
  const pageUrl = new URL(page.replace(/index\.html$/, ''), SITE);
  const refs = new Set();
  for (const pattern of [ATTRIBUTE, CSS_URL]) {
    for (const match of html.matchAll(pattern)) refs.add((match[1] ?? match[2] ?? '').trim());
  }
  for (const ref of refs) {
    if (!ref || /^(#|data:|mailto:|tel:|javascript:)/i.test(ref)) continue;
    let url;
    try {
      url = new URL(ref.replace(/&amp;/g, '&'), pageUrl);
    } catch {
      continue;
    }
    if (url.origin !== SITE) continue;
    checked += 1;
    const target = path.join(dist, decodeURIComponent(url.pathname));
    if (!exists(target)) broken.push(`${pageUrl.pathname}  ->  ${ref}`);
  }
}

console.log(`Checked ${checked} local references.`);
if (broken.length > 0) {
  console.error(`\n${broken.length} broken reference(s):\n` + broken.map((line) => '  ' + line).join('\n'));
  process.exit(1);
}
