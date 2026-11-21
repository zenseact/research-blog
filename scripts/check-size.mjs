// Reports the size of the built site against the GitHub Pages limit (1 GB) and
// lists files big enough to be worth compressing. Run after `npm run build`.
import fs from 'node:fs';
import path from 'node:path';

const LIMIT_MB = 1000;
const WARN_TOTAL_MB = 800;
const WARN_FILE_MB = 20;

const dist = path.resolve('dist');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push({ file: path.relative(dist, full), mb: fs.statSync(full).size / 1e6 });
  }
})(dist);

const total = files.reduce((sum, file) => sum + file.mb, 0);
const large = files.filter((file) => file.mb > WARN_FILE_MB).sort((a, b) => b.mb - a.mb);
const annotate = process.env.GITHUB_ACTIONS ? (message) => console.log(`::warning::${message}`) : () => {};

console.log(`Site size: ${total.toFixed(0)} MB of ${LIMIT_MB} MB (${((100 * total) / LIMIT_MB).toFixed(0)}%)`);
if (large.length > 0) {
  console.log(`\nFiles over ${WARN_FILE_MB} MB:`);
  for (const { file, mb } of large) {
    console.log(`  ${mb.toFixed(0).padStart(4)} MB  ${file}`);
    annotate(`${file} is ${mb.toFixed(0)} MB. Consider compressing it.`);
  }
}
if (total > WARN_TOTAL_MB) {
  annotate(`The site is ${total.toFixed(0)} MB; GitHub Pages allows ${LIMIT_MB} MB.`);
}
if (total > LIMIT_MB) {
  console.error(`\nThe site is over the GitHub Pages limit of ${LIMIT_MB} MB.`);
  process.exit(1);
}
