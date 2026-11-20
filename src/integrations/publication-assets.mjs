// Serves the media that lives next to each publication's markdown file
// (publications/<slug>/**) at /publications/<slug>/**, untouched.
// Posts reference their figures, videos and demos with paths relative to
// their own folder, so this is what keeps those references working.
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXT = new Set(['.md', '.mdx']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.bib': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

export default function publicationAssets({ dir = 'publications', route = '/publications/' } = {}) {
  let sourceDir;
  return {
    name: 'publication-assets',
    hooks: {
      'astro:config:setup': ({ config }) => {
        sourceDir = path.resolve(fileURLToPath(config.root), dir);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const pathname = decodeURIComponent((req.url ?? '').split('?')[0]);
          if (!pathname.startsWith(route) || pathname.endsWith('/')) return next();
          const file = path.resolve(sourceDir, pathname.slice(route.length));
          const ext = path.extname(file).toLowerCase();
          if (!file.startsWith(sourceDir + path.sep) || SOURCE_EXT.has(ext)) return next();
          let stat;
          try {
            stat = await fs.stat(file);
          } catch {
            return next();
          }
          if (!stat.isFile()) return next();

          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          res.setHeader('Accept-Ranges', 'bytes');
          // Range support so videos can seek in the dev server.
          const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
          if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
            const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
            if (start > end || start >= stat.size) {
              res.statusCode = 416;
              res.setHeader('Content-Range', `bytes */${stat.size}`);
              return res.end();
            }
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', end - start + 1);
            return createReadStream(file, { start, end }).pipe(res);
          }
          res.setHeader('Content-Length', stat.size);
          createReadStream(file).pipe(res);
        });
      },
      'astro:build:done': async ({ dir: outDir, logger }) => {
        const outRoot = path.join(fileURLToPath(outDir), route);
        let count = 0;
        let bytes = 0;
        for await (const file of walk(sourceDir)) {
          if (SOURCE_EXT.has(path.extname(file).toLowerCase())) continue;
          const dest = path.join(outRoot, path.relative(sourceDir, file));
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(file, dest);
          count += 1;
          bytes += (await fs.stat(file)).size;
        }
        logger.info(`copied ${count} publication files (${(bytes / 1e6).toFixed(0)} MB)`);
      },
    },
  };
}
