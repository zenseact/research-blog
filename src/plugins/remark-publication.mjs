// Remark plugin for publication pages. It does four things:
//
// 1. Points relative Markdown image URLs (`![](fig.png)`) at the publication's
//    own folder, so they are served as-is like every other file in that folder.
// 2. Expands the build-time tags that publication pages can use in their HTML:
//      <two-image-slider left-image="a.jpg" right-image="b.jpg" width="50" id="2" />
//      <interactive-image img-default="a.jpg" img-hover="b.jpg" img-click="c.jpg" />
//      <include-html src="demo.html" />
// 3. Removes the paragraph that Markdown wraps around such a tag when it sits
//    on its own between blank lines.
// 4. Turns <d-cite key="a,b"></d-cite> into numbered citations and appends the
//    reference list, using the references.bib file in the publication folder.
import fs from 'node:fs';
import path from 'node:path';
import { visit, SKIP } from 'unist-util-visit';
import { describeEntry, parseBibtex } from './bibtex.mjs';

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function parseAttributes(source) {
  const attrs = {};
  const pattern = /([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;
  let match;
  while ((match = pattern.exec(source))) {
    attrs[match[1].toLowerCase().replace(/_/g, '-')] = match[2] ?? match[3] ?? match[4];
  }
  return attrs;
}

function twoImageSlider(a) {
  const id = a.id ?? '';
  const linkId = a.linkid ?? '';
  const width = a.width ?? '50';
  const maxWidth = a['max-width'] ?? '1000px';
  const maxHeight = a['max-height'] ?? '1000px';
  const caption = a.caption
    ? `<figcaption class="slider__caption" style="width: ${esc(width)}vw; max-width: ${esc(maxWidth)};"><b>Fig. ${esc(id)}:</b> ${a.caption}</figcaption>`
    : '';
  return (
    `<div class="two-image-slider">` +
    `<div class="slider__container" style="width: ${esc(width)}vw; max-width: ${esc(maxWidth)}; max-height: ${esc(maxHeight)};">` +
    `<div class="slider__img__bg" id="slider__background${esc(id)}" style="background-image: url(${esc(a['right-image'] ?? '')});">` +
    `<div class="slider__img__bg__overlay" id="slider__overlay${esc(id)}" style="background-image: url(${esc(a['left-image'] ?? '')});"></div>` +
    `<div class="slider__button" id="slider__button${esc(id)}"></div>` +
    `<input type="range" min="0" max="100" value="50" step="0.1" class="slider__input" id="slider__input${esc(id)}" ` +
    `aria-label="Image comparison slider" oninput="moveDivisor(${JSON.stringify(id).replace(/"/g, "'")}, ${linkId ? JSON.stringify(linkId).replace(/"/g, "'") : 'null'})">` +
    `</div></div>${caption}` +
    `<script>adjustAspectRatio(document.getElementById(${JSON.stringify('slider__background' + id)}), ${Number(width) || 50});</script>` +
    `</div>`
  );
}

function interactiveFigure({ imgDefault, imgHover, imgClick, alt, caption, id }) {
  const label = esc(alt || 'Interactive image');
  return (
    `<figure class="interactive-image-container"${id ? ` id="${esc(id)}"` : ''} aria-label="${label}">` +
    `<img src="${esc(imgDefault)}" class="interactive-image image-default" alt="${label} - Default View" loading="lazy">` +
    `<img src="${esc(imgHover)}" class="interactive-image image-hover" alt="${label} - Hover View" loading="lazy" aria-hidden="true">` +
    `<img src="${esc(imgClick)}" class="interactive-image image-click" alt="${label} - Click View" loading="lazy" aria-hidden="true">` +
    (caption ? `<figcaption>${caption}</figcaption>` : '') +
    `</figure>`
  );
}

function interactiveImage(a) {
  const suffix = a['id-suffix'];
  if (a.columns && a.images) {
    const figures = a.images
      .trim()
      .split('|')
      .map((set) => set.split(',').map((part) => part.trim()))
      .filter((parts) => parts[0] && parts[1] && parts[2])
      .map(([imgDefault, imgHover, imgClick, alt, caption]) =>
        interactiveFigure({ imgDefault, imgHover, imgClick, alt, caption }),
      )
      .join('');
    return `<div class="interactive-images-grid columns-${esc(a.columns)}"${suffix ? ` id="interactive-images-${esc(suffix)}"` : ''}>${figures}</div>`;
  }
  return interactiveFigure({
    imgDefault: a['img-default'] ?? '',
    imgHover: a['img-hover'] ?? '',
    imgClick: a['img-click'] ?? '',
    alt: a['alt-text'],
    caption: a.caption,
    id: suffix ? `interactive-image-${suffix}` : undefined,
  });
}

const TAGS = {
  'two-image-slider': (attrs) => twoImageSlider(attrs),
  'interactive-image': (attrs) => interactiveImage(attrs),
  'include-html': (attrs, dir, file) => {
    if (!attrs.src) file.fail('<include-html> needs a src attribute');
    if (!dir) file.fail('<include-html> can only be used in a file on disk');
    const target = path.resolve(dir, attrs.src);
    if (!target.startsWith(dir + path.sep)) {
      file.fail(`<include-html src="${attrs.src}"> must stay inside the publication folder`);
    }
    if (!fs.existsSync(target)) file.fail(`<include-html src="${attrs.src}">: file not found`);
    return fs.readFileSync(target, 'utf8');
  },
};

const TAG_PATTERN = new RegExp(
  `<(${Object.keys(TAGS).join('|')})\\b((?:[^>"']|"[^"]*"|'[^']*')*?)\\/?>(?:\\s*<\\/\\1\\s*>)?`,
  'g',
);
const CLOSING_PATTERN = new RegExp(`<\\/(${Object.keys(TAGS).join('|')})\\s*>`, 'g');

const CITE_PATTERN = /<d-cite\b([^>]*)>(?:\s*<\/d-cite\s*>)?/g;
const CITE_CLOSING_PATTERN = /<\/d-cite\s*>/g;

function citations(tree, file, dir) {
  const bibFile = dir && path.join(dir, 'references.bib');
  let entries;
  const order = [];
  const numberOf = (key) => {
    if (!order.includes(key)) order.push(key);
    return order.indexOf(key) + 1;
  };
  visit(tree, 'html', (node) => {
    if (!node.value.includes('d-cite')) return;
    node.value = node.value
      .replace(CITE_PATTERN, (_all, attrs) => {
        entries ??= bibFile && fs.existsSync(bibFile) ? parseBibtex(fs.readFileSync(bibFile, 'utf8')) : new Map();
        const keys = (parseAttributes(attrs).key ?? '').split(',').map((key) => key.trim()).filter(Boolean);
        const links = keys.map((key) => {
          const entry = entries.get(key);
          if (!entry) {
            file.message(`<d-cite key="${key}">: no such entry in references.bib`);
            return '?';
          }
          const { authors, title, year } = describeEntry(entry);
          const tip = [authors, year].filter(Boolean).join(', ') + (title ? `. ${title}` : '');
          return `<a href="#ref-${esc(key)}" title="${esc(tip)}">${numberOf(key)}</a>`;
        });
        return `<sup class="citation">[${links.join(', ')}]</sup>`;
      })
      .replace(CITE_CLOSING_PATTERN, '');
  });
  if (order.length === 0) return;
  const items = order.map((key) => {
    const { title, authors, year, details, url } = describeEntry(entries.get(key));
    const heading = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>` : esc(title);
    const byline = [[authors, year].filter(Boolean).join(', '), details].filter(Boolean).map(esc).join('. ');
    return `<li id="ref-${esc(key)}"><span class="references__title">${heading}</span><br>${byline}${byline ? '.' : ''}</li>`;
  });
  tree.children.push({
    type: 'html',
    value: `<section class="references"><h3 id="references">References</h3><ol>${items.join('')}</ol></section>`,
  });
}

const isRelativeUrl = (url) => !!url && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);

export default function remarkPublication() {
  return (tree, file) => {
    const filePath = file.path ?? file.history?.[0];
    const dir = filePath ? path.dirname(path.resolve(filePath)) : undefined;
    const match = filePath && /(?:^|[\\/])publications[\\/]([^\\/]+)[\\/][^\\/]+$/.exec(filePath);
    const baseUrl = match ? `/publications/${match[1]}/` : undefined;

    if (baseUrl) {
      visit(tree, 'image', (node) => {
        if (isRelativeUrl(node.url)) node.url = baseUrl + node.url.replace(/^\.\//, '');
      });
    }

    citations(tree, file, dir);

    const expanded = new Set();
    visit(tree, 'html', (node) => {
      const before = node.value;
      node.value = before
        .replace(TAG_PATTERN, (_all, tag, attrs) => TAGS[tag](parseAttributes(attrs), dir, file))
        .replace(CLOSING_PATTERN, '');
      if (node.value !== before) expanded.add(node);
    });

    if (expanded.size === 0) return;
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const onlyTags = node.children.every(
        (child) => child.type === 'html' || (child.type === 'text' && !child.value.trim()),
      );
      if (!onlyTags || !node.children.some((child) => expanded.has(child))) return;
      const html = node.children.filter((child) => child.type === 'html');
      parent.children.splice(index, 1, ...html);
      return [SKIP, index + html.length];
    });
  };
}
