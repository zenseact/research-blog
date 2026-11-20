// Small BibTeX reader for the references.bib files that sit next to a publication.
// Covers what reference lists need: entries, brace- or quote-delimited fields,
// common LaTeX accents, and author lists.

const ACCENTS = {
  '"': '̈',
  "'": '́',
  '`': '̀',
  '^': '̂',
  '~': '̃',
  '=': '̄',
  '.': '̇',
  u: '̆',
  v: '̌',
  H: '̋',
  c: '̧',
  k: '̨',
  r: '̊',
};
const SYMBOLS = { aa: 'å', AA: 'Å', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', ss: 'ß', l: 'ł', L: 'Ł', i: 'ı', j: 'ȷ' };

export function latexToText(value) {
  return value
    .replace(/\\([`'"^~=.])\s*\{?\\?([A-Za-z])\}?/g, (_m, accent, letter) => (letter + ACCENTS[accent]).normalize('NFC'))
    .replace(/\\([uvHckr])\s*\{\\?([A-Za-z])\}/g, (_m, accent, letter) => (letter + ACCENTS[accent]).normalize('NFC'))
    .replace(/\\(aa|AA|ae|AE|ss|o|O|l|L|i|j)(?![A-Za-z])\s*/g, (_m, name) => SYMBOLS[name])
    .replace(/\\([&%$#_])/g, '$1')
    .replace(/\\(?:textit|textbf|emph|texttt|mathrm|text)\s*\{([^{}]*)\}/g, '$1')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/~/g, ' ')
    .replace(/[{}$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readValue(source, start) {
  // Reads one field value (possibly several parts joined with #) starting at `start`.
  let index = start;
  let value = '';
  for (;;) {
    while (/\s/.test(source[index])) index += 1;
    const open = source[index];
    if (open === '{' || open === '"') {
      const close = open === '{' ? '}' : '"';
      let depth = 0;
      let end = index + 1;
      for (; end < source.length; end += 1) {
        const char = source[end];
        if (char === '\\') end += 1;
        else if (char === '{') depth += 1;
        else if (char === '}' && (depth > 0 || close !== '}')) depth -= 1;
        else if (char === close && depth === 0) break;
      }
      value += source.slice(index + 1, end);
      index = end + 1;
    } else {
      const bare = /^[^\s,#}]+/.exec(source.slice(index));
      if (!bare) break;
      value += bare[0];
      index += bare[0].length;
    }
    while (/\s/.test(source[index])) index += 1;
    if (source[index] !== '#') break;
    index += 1;
  }
  return [value, index];
}

/** @returns {Map<string, {type: string, key: string, fields: Record<string, string>}>} */
export function parseBibtex(source) {
  const entries = new Map();
  const header = /@([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,/g;
  let match;
  while ((match = header.exec(source))) {
    const type = match[1].toLowerCase();
    if (type === 'comment' || type === 'string' || type === 'preamble') continue;
    const fields = {};
    let index = header.lastIndex;
    for (;;) {
      const name = /^\s*([A-Za-z][\w-]*)\s*=/.exec(source.slice(index));
      if (!name) break;
      const [raw, next] = readValue(source, index + name[0].length);
      fields[name[1].toLowerCase()] = raw;
      index = next;
      const comma = /^\s*,/.exec(source.slice(index));
      if (!comma) break;
      index += comma[0].length;
    }
    header.lastIndex = index;
    entries.set(match[2], { type, key: match[2], fields });
  }
  return entries;
}

function formatAuthor(name) {
  const clean = latexToText(name);
  let last;
  let given;
  if (clean.includes(',')) {
    [last, given = ''] = clean.split(',').map((part) => part.trim());
  } else {
    const parts = clean.split(' ');
    last = parts.pop();
    given = parts.join(' ');
  }
  const initials = given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part.split('-').map((piece) => piece[0].toUpperCase() + '.').join('-'))
    .join('');
  return initials ? `${last}, ${initials}` : last;
}

export function formatAuthors(field = '') {
  const names = field.split(/\s+and\s+/i).map((name) => name.trim()).filter(Boolean);
  const truncated = /^others$/i.test(names.at(-1) ?? '');
  const formatted = (truncated ? names.slice(0, -1) : names).map(formatAuthor);
  if (truncated) return `${formatted.join(', ')} et al.`;
  if (formatted.length <= 1) return formatted.join('');
  return `${formatted.slice(0, -1).join(', ')} and ${formatted.at(-1)}`;
}

/** Parts of one reference, as plain text. */
export function describeEntry(entry) {
  const f = entry.fields;
  const text = (name) => (f[name] ? latexToText(f[name]) : '');
  const arxiv = /arxiv/i.test(f.journal ?? f.archiveprefix ?? '') && /(\d{4}\.\d{4,5})/.exec(`${f.eprint ?? ''} ${f.journal ?? ''}`);
  const url =
    f.url?.trim() ||
    (f.doi ? `https://doi.org/${f.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}` : '') ||
    (arxiv ? `https://arxiv.org/abs/${arxiv[1]}` : '');
  const venue = text('journal') || text('booktitle') || text('publisher') || text('howpublished') || text('school') || text('institution');
  const volume = text('volume') + (f.number ? `(${text('number')})` : '');
  const pages = text('pages');
  const details = [venue, volume, pages && `pp. ${pages}`].filter(Boolean).join(', ');
  return {
    title: text('title'),
    authors: formatAuthors(f.author ?? f.editor),
    year: text('year'),
    details,
    url,
  };
}
