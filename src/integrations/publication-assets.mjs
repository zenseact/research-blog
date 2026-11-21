// Serves the media that lives next to each publication's markdown file
// (publications/<slug>/**) at /publications/<slug>/**, untouched.
// Posts reference their figures, videos and demos with paths relative to
// their own folder, so this is what keeps those references working.
//
// It also makes the still image of a video thumbnail (see posterPath): one frame
// of the video, written to the build and to the cache, never to publications/.
import { execFile } from 'node:child_process';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { load as parseYaml } from 'js-yaml';
import { POSTER_SUFFIX, posterPath } from '../lib/poster-path.mjs';

const run = promisify(execFile);

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

const VIDEO_EXT = ['.mp4', '.webm', '.mov'];
// The first frames of a video are often black or a fade-in.
const POSTER_SECONDS = [1, 0];

const exists = (file) => fs.access(file).then(() => true, () => false);
const modified = (file) => fs.stat(file).then((stat) => stat.mtimeMs, () => 0);

async function writePoster(video, poster) {
  if ((await modified(poster)) > (await modified(video))) return;
  await fs.mkdir(path.dirname(poster), { recursive: true });
  for (const seconds of POSTER_SECONDS) {
    // ffmpeg writes nothing, without an error, when the video is shorter than the seek time.
    await fs.rm(poster, { force: true });
    await run(ffmpeg, [
      '-v', 'error', '-y', '-ss', String(seconds), '-i', video,
      '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', poster,
    ]);
    if (await exists(poster)) return;
  }
  throw new Error(`Could not take a still image from ${video}`);
}

// Video thumbnails that have no thumbnail-poster of their own, as paths relative to `sourceDir`.
async function videoThumbnails(sourceDir) {
  const videos = [];
  for await (const file of walk(sourceDir)) {
    if (!SOURCE_EXT.has(path.extname(file).toLowerCase())) continue;
    const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(await fs.readFile(file, 'utf8'));
    const data = frontMatter ? parseYaml(frontMatter[1]) : undefined;
    if (!data?.['thumbnail-video'] || data['thumbnail-poster']) continue;
    videos.push(path.join(path.relative(sourceDir, path.dirname(file)), data['thumbnail-video']));
  }
  return videos;
}

export default function publicationAssets({ dir = 'publications', route = '/publications/' } = {}) {
  let sourceDir;
  let posterDir;
  const pending = new Map();

  // The cached poster for a request such as "neurad/clip.poster.jpg", made from "neurad/clip.mp4".
  async function posterFor(relative) {
    if (!relative.endsWith(POSTER_SUFFIX)) return undefined;
    const stem = path.resolve(sourceDir, relative.slice(0, -POSTER_SUFFIX.length));
    if (!stem.startsWith(sourceDir + path.sep)) return undefined;
    for (const ext of VIDEO_EXT) {
      if (!(await exists(stem + ext))) continue;
      const poster = path.join(posterDir, relative);
      // The page and its link preview can ask for the same poster at once.
      if (!pending.has(poster)) {
        pending.set(poster, writePoster(stem + ext, poster).finally(() => pending.delete(poster)));
      }
      await pending.get(poster);
      return poster;
    }
    return undefined;
  }

  function configureServer(server) {
    const serve = async (req, res, next) => {
      const pathname = decodeURIComponent((req.url ?? '').split('?')[0]);
      if (!pathname.startsWith(route)) return next();
      // A folder with an index.html is served like GitHub Pages serves it.
      const relative = pathname.slice(route.length) + (pathname.endsWith('/') ? 'index.html' : '');
      let file = path.resolve(sourceDir, relative);
      const ext = path.extname(file).toLowerCase();
      if (!file.startsWith(sourceDir + path.sep) || SOURCE_EXT.has(ext)) return next();
      let stat;
      try {
        if (!(await exists(file))) file = (await posterFor(relative)) ?? file;
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
    };
    // Astro puts a guard at the front of the middleware stack that answers page requests for files
    // outside src/ and public/ with a 404. That would block the .html files of a publication (demos
    // opened in an iframe or a new tab), so this handler goes in front of it.
    return () => {
      server.middlewares.stack.unshift({ route: '', handle: serve });
    };
  }

  return {
    name: 'publication-assets',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        sourceDir = path.resolve(fileURLToPath(config.root), dir);
        posterDir = path.join(fileURLToPath(config.cacheDir), 'posters');
        updateConfig({ vite: { plugins: [{ name: 'publication-assets', configureServer }] } });
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

        const videos = await videoThumbnails(sourceDir);
        for (const video of videos) {
          const relative = posterPath(video);
          const dest = path.join(outRoot, relative);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          const poster = await posterFor(relative);
          if (!poster) throw new Error(`thumbnail-video not found: ${path.join(dir, video)}`);
          await fs.copyFile(poster, dest);
        }
        if (videos.length) logger.info(`made ${videos.length} still images from video thumbnails`);
      },
    },
  };
}
