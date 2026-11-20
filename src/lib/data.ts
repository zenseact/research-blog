// Shared site data, edited by contributors in data/*.yml.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

export interface Author {
  /** [first name, initial, initials, full name] */
  firstname: string[];
  github?: string;
  linkedin?: string;
  mail?: string;
  org?: string | string[];
  picture?: string;
  scholar?: string;
  title?: string;
  url?: string;
  orcid?: string;
}

export interface Venue {
  name: string;
  url?: string;
  series?: string;
}

export interface Topic {
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface NavLink {
  title: string;
  url: string;
}

function load<T>(file: string): T {
  return parseYaml(fs.readFileSync(path.resolve('data', file), 'utf8')) as T;
}

export const authors = load<Record<string, Author>>('authors.yml');
export const venues = load<Record<string, Venue>>('venues.yml');
export const topics = load<Topic[]>('research_topics.yml');
export const navigation = load<{ main: NavLink[] }>('navigation.yml').main;

export const authorName = (key: string) => authors[key]?.firstname?.[3] ?? key;

export function authorUrl(key: string): string | undefined {
  const author = authors[key];
  if (author?.url) return author.url;
  if (author?.scholar) return `https://scholar.google.com/citations?user=${author.scholar}`;
  return undefined;
}
