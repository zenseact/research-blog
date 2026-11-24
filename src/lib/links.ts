/** Icons a button can have. The values are Font Awesome classes, except for `huggingface`. */
export const LINK_ICONS = {
  paper: 'fas fa-file-alt',
  doi: 'fas fa-book-open',
  code: 'fab fa-github',
  website: 'fas fa-globe',
  video: 'fas fa-play',
  demo: 'fas fa-desktop',
  dataset: 'fas fa-database',
  model: 'fas fa-cube',
  slides: 'fas fa-chalkboard',
  poster: 'fas fa-image',
  link: 'fas fa-external-link-alt',
  huggingface: '',
} as const;

export type LinkIcon = keyof typeof LINK_ICONS;
export const LINK_ICON_NAMES = Object.keys(LINK_ICONS) as [LinkIcon, ...LinkIcon[]];

export interface LinkButton {
  href: string;
  label: string;
  icon: LinkIcon;
}
