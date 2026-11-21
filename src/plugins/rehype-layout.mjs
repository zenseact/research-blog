// Rehype plugin that decides which top-level blocks of a publication page may
// use the full page width. The page body is a text column; this plugin wraps
// the blocks that should break out of it in <div class="prose__wide">.
//
// - Media blocks (figures, videos, sliders, tables, iframes, custom HTML that
//   holds any of these) break out, unless most of what they hold is text.
// - A paragraph that only holds an image breaks out.
// - Text written directly at the top level, without a <p>, is given one.
// - Everything else stays in the column.

const TEXT_BLOCKS = new Set(['p', 'ul', 'ol', 'dl', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr']);
const INVISIBLE = new Set(['script', 'style', 'link', 'template', 'meta']);
const MEDIA = new Set(['img', 'video', 'iframe', 'canvas', 'svg', 'table', 'picture', 'object', 'embed']);
const MEDIA_CLASSES = ['two-image-slider', 'interactive-image-container'];
const INLINE = new Set([
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'em', 'i', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u',
]);
// Captions and labels do not make a media block a text block.
const NOT_BODY_TEXT = new Set(['figcaption', 'table', 'button', 'label', 'select', 'script', 'style']);
const BODY_TEXT = new Set(['p', 'li', 'dd']);
// A media block holding more running text than this is laid out as text.
const TEXT_BLOCK_CHARS = 300;

const classes = (node) => [node.properties?.className ?? []].flat();
const isElement = (node, tag) => node.type === 'element' && (!tag || node.tagName === tag);
const isBlank = (node) => node.type === 'text' && !node.value.trim();

const isDisplayMath = (node) => classes(node).includes('katex-display');

function hasMedia(node) {
  if (!isElement(node)) return false;
  if (MEDIA.has(node.tagName) || classes(node).some((name) => MEDIA_CLASSES.includes(name))) return true;
  return node.children.some(hasMedia);
}

function textLength(node) {
  if (node.type === 'text') return node.value.trim().length;
  if (!isElement(node) || NOT_BODY_TEXT.has(node.tagName)) return 0;
  return node.children.reduce((sum, child) => sum + textLength(child), 0);
}

function bodyTextLength(node) {
  if (!isElement(node) || NOT_BODY_TEXT.has(node.tagName)) return 0;
  if (BODY_TEXT.has(node.tagName)) return textLength(node);
  return node.children.reduce((sum, child) => sum + bodyTextLength(child), 0);
}

function isImageParagraph(node) {
  const content = node.children.filter((child) => !isBlank(child));
  if (content.length !== 1) return false;
  const only = isElement(content[0], 'a') ? content[0].children.filter((child) => !isBlank(child)) : content;
  return only.length === 1 && isElement(only[0], 'img');
}

function isWide(node) {
  if (!isElement(node) || INVISIBLE.has(node.tagName)) return false;
  if (node.tagName === 'p') return isImageParagraph(node);
  if (TEXT_BLOCKS.has(node.tagName) || isDisplayMath(node)) return false;
  return hasMedia(node) && bodyTextLength(node) < TEXT_BLOCK_CHARS;
}

const isInline = (node) =>
  node.type === 'text' || (isElement(node) && INLINE.has(node.tagName) && !isDisplayMath(node) && !hasMedia(node));

const element = (tagName, className, children) => ({
  type: 'element',
  tagName,
  properties: className ? { className: [className] } : {},
  children,
});

export default function rehypeLayout() {
  return (tree) => {
    const output = [];
    let run = [];
    const flushRun = () => {
      const hasText = run.some((node) => node.type === 'text' && node.value.trim());
      if (hasText) output.push(element('p', null, run));
      else output.push(...run);
      run = [];
    };
    for (const node of tree.children) {
      if (isInline(node)) {
        run.push(node);
        continue;
      }
      flushRun();
      output.push(isWide(node) ? element('div', 'prose__wide', [node]) : node);
    }
    flushRun();
    tree.children = output;
  };
}
