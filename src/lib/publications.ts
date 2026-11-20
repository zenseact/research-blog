import { getCollection, type CollectionEntry } from 'astro:content';
import { authorName, venues } from './data';

export type Publication = CollectionEntry<'publications'>;

export interface Thumbnail {
  kind: 'image' | 'video';
  src: string;
  /** Still image: the image itself, or the poster of a video (if it has one). */
  still?: string;
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
    return { kind: 'video', src: base + video, still: poster ? base + poster : undefined };
  }
  return undefined;
}

export const authorNames = (pub: Publication) => pub.data.authors.map(authorName);

export function venueLabel(pub: Publication): string {
  const venue = venues[pub.data.venue];
  const year = pub.data.date.getFullYear();
  // Short form for cards: "arXiv (preprint)" becomes "arXiv".
  const series = (venue?.series ?? venue?.name ?? pub.data.venue).replace(/\s*\(.*?\)\s*$/, '');
  const label = /\d{4}/.test(series) ? series : `${series} ${year}`;
  // A workshop paper should not read as a main-conference paper.
  return /workshop/i.test(venue?.name ?? '') && !/workshop/i.test(label) ? `${label} Workshop` : label;
}

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
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
}
