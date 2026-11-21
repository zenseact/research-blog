import { getCollection, type CollectionEntry } from 'astro:content';
import { authorName, venues } from './data';
import type { LinkButton, LinkIcon } from './links';
import { posterPath } from './poster-path.mjs';

export type Publication = CollectionEntry<'publications'>;

export interface Thumbnail {
  kind: 'image' | 'video';
  src: string;
  /** Still image: the image itself, or the poster of a video. */
  still: string;
}

export const publicationUrl = (pub: Publication) => `/publications/${pub.id}/`;

export async function getPublications(): Promise<Publication[]> {
  const all = await getCollection('publications');
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getThumbnail(pub: Publication): Thumbnail | undefined {
  const base = publicationUrl(pub);
  const image = pub.data['thumbnail-img'] ?? pub.data['thumbnail-gif'];
  if (image) return { kind: 'image', src: base + image, still: base + image };
  const video = pub.data['thumbnail-video'];
  if (video) {
    const poster = pub.data['thumbnail-poster'];
    return { kind: 'video', src: base + video, still: base + (poster ?? posterPath(video)) };
  }
  return undefined;
}

const isAbsolute = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url);

function iconForUrl(url: string): LinkIcon {
  const host = isAbsolute(url) ? new URL(url).hostname.replace(/^www\./, '') : '';
  if (host === 'huggingface.co' || host === 'hf.co') return 'huggingface';
  if (host === 'github.com') return 'code';
  if (host === 'youtube.com' || host === 'youtu.be') return 'video';
  return 'link';
}

/** The buttons under the title: the named front matter links first, then the `links` list. */
export function getLinkButtons(pub: Publication): LinkButton[] {
  const { data } = pub;
  const paper = data.paper ?? data.arxiv;
  const buttons: LinkButton[] = [];
  if (paper) buttons.push({ href: paper, label: 'Paper', icon: 'paper' });
  if (data.doi) buttons.push({ href: `https://doi.org/${data.doi}`, label: paper ? 'DOI' : 'Paper', icon: 'doi' });
  if (data.code) buttons.push({ href: data.code, label: 'Code', icon: 'code' });
  if (data.website) buttons.push({ href: data.website, label: 'Project page', icon: 'website' });
  if (data.video) buttons.push({ href: data.video, label: 'Video', icon: 'video' });
  for (const link of data.links ?? []) {
    buttons.push({
      // A relative address points into the publication folder.
      href: isAbsolute(link.url) ? link.url : publicationUrl(pub) + link.url.replace(/^\.\//, ''),
      label: link.label,
      icon: link.icon ?? iconForUrl(link.url),
    });
  }
  return buttons;
}

export const authorNames = (pub: Publication) => pub.data.authors.map(authorName);

export function venueLabel(pub: Publication): string {
  const venue = venues[pub.data.venue];
  // The venue's own year: a paper is often dated the year before its conference.
  const year = /\b(19|20)\d{2}\b/.exec(venue?.name ?? '')?.[0] ?? pub.data.date.getFullYear();
  // Short form for cards: "arXiv (preprint)" becomes "arXiv".
  const series = (venue?.series ?? venue?.name ?? pub.data.venue).replace(/\s*\(.*?\)\s*$/, '');
  const label = /\d{4}/.test(series) ? series : `${series} ${year}`;
  // A workshop paper should not read as a main-conference paper.
  return /workshop/i.test(venue?.name ?? '') && !/workshop/i.test(label) ? `${label} Workshop` : label;
}

// HTML entities that posts use in running text.
const ENTITIES: Record<string, string> = { times: '×', mdash: '—', ndash: '–', rarr: '→', harr: '↔', amp: '&' };

/** Plain-text summary for meta tags: the frontmatter description, or the start of the abstract. */
export function getDescription(pub: Publication, maxLength = 220): string {
  if (pub.data.description) return pub.data.description;
  const body = pub.body ?? '';
  const abstract = /^#+\s*Abstract\s*$/im.exec(body);
  const source = abstract ? body.slice(abstract.index + abstract[0].length) : body;
  const paragraph = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<(script|style|figure|figcaption)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block.length > 80 && !/^(#|---|\||!\[|\$\$)/.test(block));
  if (!paragraph) return pub.data.title;
  const text = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/&([a-z]+);/gi, (_, name) => ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
}
