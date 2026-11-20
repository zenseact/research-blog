import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { authors, venues, topics } from './lib/data';

const oneOf = (values: string[], what: string, file: string) =>
  z.string().refine((value) => values.includes(value), {
    error: (issue) => `Unknown ${what} "${issue.input}". Add it to data/${file} or fix the spelling.`,
  });

const publications = defineCollection({
  // One folder per paper: publications/<slug>/<anything>.md, served at /publications/<slug>/.
  loader: glob({
    base: './publications',
    pattern: '*/*.md',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.strictObject({
    // Titles written for the Jekyll site may contain numeric HTML entities such as &#8212;.
    title: z.string().transform((title) =>
      title.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
        String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)),
      ),
    ),
    date: z.coerce.date(),
    venue: oneOf(Object.keys(venues), 'venue', 'venues.yml'),
    authors: z.array(oneOf(Object.keys(authors), 'author', 'authors.yml')).min(1),
    topics: z
      .array(oneOf(topics.map((topic) => topic.slug), 'topic', 'research_topics.yml'))
      .min(1),
    n_equal_contrib: z.number().int().optional(),
    extras: z.string().optional(),
    // Links
    paper: z.url().nullish(),
    // Older name for `paper`. Still accepted.
    arxiv: z.url().nullish(),
    code: z.url().nullish(),
    website: z.url().nullish(),
    video: z.url().nullish(),
    doi: z.string().nullish(),
    // Thumbnail: a file in the publication folder. Use exactly one.
    'thumbnail-img': z.string().optional(),
    'thumbnail-gif': z.string().optional(),
    'thumbnail-video': z.string().optional(),
    // Still image for a video thumbnail: shown before the video plays and in link previews.
    'thumbnail-poster': z.string().optional(),
    // Where the thumbnail appears on the publication page. `none` keeps it for cards and link previews only.
    'thumbnail-position': z.enum(['side', 'below', 'none']).default('side'),
    // Short summary for link previews and search engines. Defaults to the start of the abstract.
    description: z.string().optional(),
    // Left over from the Jekyll site. Accepted so old files keep working; not used.
    layout: z.string().optional(),
    permalink: z.string().optional(),
    usemathjax: z.boolean().optional(),
  }),
});

export const collections = { publications };
