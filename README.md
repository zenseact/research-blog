# Zenseact Research Blog

Source for [research.zenseact.com](https://research.zenseact.com), where we share our research with the community. We aim to publish **at least the abstract of every paper**; richer project pages with figures, videos and demos are very welcome.

The site is built with [Astro](https://astro.build) and deployed to GitHub Pages when a pull request is merged to `main`.

## Preview the site locally

You need [Node.js](https://nodejs.org) 22 or newer.

```
npm install
npm run dev
```

Then open [http://localhost:4321](http://localhost:4321). Pages reload as you edit.

Before opening a pull request, run `npm run check`. It builds the site, checks that every image, video and link to a local file resolves, and reports the size of the build. The same checks run on every pull request.

## Add a publication

### Step 1: create a folder

Create a folder in `publications/` named after the paper, for example `publications/raw-or-cooked/`. The folder name becomes the address: `research.zenseact.com/publications/raw-or-cooked/`.

Everything that belongs to the paper (the Markdown file, figures, videos) goes in this folder.

### Step 2: add a Markdown file with the metadata

Create one `.md` file in the folder, for example `raw-or-cooked.md`, starting with this front matter:

```yaml
---
title: Raw or Cooked? Object detection on RAW images
venue: SCIA23 # A key in data/venues.yml
authors: # Keys in data/authors.yml, in author order
  - Ljungbergh
  - Johnander
  - Petersson
  - Felsberg
date: 2023-01-21 # Publication or submission date
topics: # At least one slug from data/research_topics.yml
  - Perception & motion forecasting
arxiv: https://arxiv.org/abs/2301.08965
thumbnail-img: thumbnail.png # A file in this folder
---
```

Required: `title`, `venue`, `authors`, `date`, `topics`. All other fields are optional:

| Field | What it does |
|---|---|
| `arxiv` | Link to the paper. Shown as an "arXiv" button (or "Paper" if it is not an arXiv link). |
| `doi` | DOI without the domain, e.g. `10.1016/j.automatica.2023.111394`. |
| `code` | Link to the code. Shown as a "Code" button. |
| `website` | Link to an external project page. |
| `video` | Link to a video, e.g. on YouTube. |
| `n_equal_contrib` | Marks the first *n* authors as equal contributors. |
| `extras` | Short note shown next to the venue, e.g. `Oral presentation`. |
| `thumbnail-img` | Image shown at the top of the page, on cards and in link previews. `thumbnail-gif` works the same way. |
| `thumbnail-video` | Video shown instead of an image. Add `thumbnail-poster` (a still image) as well: it is what link previews and the publication list show. |
| `thumbnail-position` | How the thumbnail appears on the publication page. `side` (the default): next to the title, on a dark band filled with a blurred copy of the thumbnail. `below`: large, under the title. `none`: not on the page; still used for cards and link previews. |
| `description` | One or two sentences for search engines and link previews. Defaults to the start of the abstract. |

The build fails with a message naming the problem if an author, venue or topic is not found in `data/`, or if a field is misspelled.

Topics currently available:

- `Perception & motion forecasting`
- `Localization & mapping`
- `Representation learning`
- `Simulation`
- `Planning & decision-making`
- `Safety`
- `Verification & validation`
- `Datasets & benchmarks`
- `Theory & foundations`

If none fits, add one to `data/research_topics.yml` in your pull request.

### Step 3: write the page

Below the front matter, write the page in Markdown. A good minimum is the abstract and a BibTeX entry:

````markdown
# Abstract
Existing datasets for autonomous driving ...

# BibTeX
```bibtex
@inproceedings{...}
```
````

A `bibtex` code block automatically gets a copy button, and the page gets a "Cite" button that jumps to it.

Beyond that you can use anything Markdown and HTML offer:

- **Figures and videos.** Put the files in the publication folder and refer to them with paths relative to it: `![Overview](figures/overview.png)` or `<video src="videos/demo.mp4" controls></video>`.
- **Math.** `$$ ... $$` inline or as a block on its own lines, rendered with KaTeX.
- **Citations.** Add a `references.bib` file to the folder and cite with `<d-cite key="he2016deep"></d-cite>`. Numbered citations and a reference list are generated for you.
- **Custom HTML, CSS and JavaScript.** Raw HTML is passed through untouched, including `<style>` and `<script>`. Text is kept to a readable column; figures, videos, tables and any other HTML block you place at the top level can use the full page width.

Three tags are expanded when the site is built:

```html
<!-- Before/after comparison with a draggable divider. Give each slider on a page its own id. -->
<two-image-slider
  left-image="ours.jpg"
  right-image="baseline.jpg"
  width="50"
  id="1"
  caption="Ours vs. baseline."
/>

<!-- Image that changes on hover and on click. -->
<interactive-image img-default="a.jpg" img-hover="b.jpg" img-click="c.jpg" caption="Hover and click." />

<!-- Inserts another HTML file from the publication folder, e.g. a self-contained demo. -->
<include-html src="demo.html" />
```

Optional attributes for `<two-image-slider>`: `max-width`, `max-height` (CSS lengths) and `linkid` (the `id` of another slider that should move together with this one). `<interactive-image>` also accepts `columns` together with `images="default,hover,click,alt,caption|..."` to lay out several in a row.

Two things to know when mixing Markdown and HTML:

- Leave a blank line between an HTML block and the Markdown that follows it. Without one, the Markdown is treated as part of the HTML and shown as plain text.
- Markdown is not processed inside an HTML block unless it is separated from the tags by blank lines.

### Step 4: mind the file sizes

GitHub Pages limits the whole site to 1 GB, and media files are what fill it. `npm run check` prints the current size and lists files over 20 MB. Please compress videos before adding them (for example `ffmpeg -i in.mp4 -crf 28 -preset slow -an out.mp4`), prefer short MP4 loops over GIFs, and link to YouTube for long videos.

### Step 5: open a pull request

Once it is merged, the page is published automatically.

## Add an author

Add an entry to `data/authors.yml`:

```yaml
Ljungbergh: # Unique key, used in the authors list of a publication
  firstname: ["William", "W.", "W. L.", "William Ljungbergh"] # First name, initial, initials, full name
  org: [Zenseact, Linköping University] # Affiliation(s); a single value also works
  url: https://ljungbergh.com # Personal website (optional)
  scholar: RXEPFo0AAAAJ # Google Scholar ID (optional)
  orcid: 0000-0002-0194-6346 # (optional)
  github: wljungbergh # (optional)
  linkedin: william-ljungbergh # (optional)
  mail: william.ljungbergh@zenseact.com # (optional)
  title: PhD Student # (optional)
  picture: /assets/images/profiles/william_ljungbergh.jpg # (optional)
```

Only `firstname` is required. On a publication page, the author's name links to `url` if set, otherwise to their Google Scholar profile. Affiliations are listed on a publication page only when every author of that paper has an `org`.

## Add a venue

Add an entry to `data/venues.yml`:

```yaml
ICCV23: # Unique key, used in the venue field of a publication
  name: International Conference on Computer Vision (ICCV), 2023 # Shown on the publication page
  url: https://iccv2023.thecvf.com # (optional)
  series: ICCV # Short name. Groups venues in the filter on the publications page (ICCV23, ICCV25, ... all appear as "ICCV")
```

## How the site is put together

For those maintaining the site itself:

| Path | Contents |
|---|---|
| `publications/` | One folder per paper: Markdown plus media. Media is copied to the site as-is, at the same relative paths. |
| `data/` | Authors, venues, research topics, navigation. |
| `src/content.config.ts` | Front matter schema and validation. |
| `src/layouts/`, `src/pages/` | Page templates: home, publications list, research topics, publication page. |
| `src/styles/` | `site.css` (design tokens, header, cards, lists), `prose.css` (publication text), `legacy.css` (classes older publication pages rely on). |
| `src/plugins/remark-publication.mjs` | Expands the build-time tags and citations described above. |
| `src/integrations/publication-assets.mjs` | Serves and copies the media files in `publications/`. |
| `scripts/` | Checks run by `npm run check` and in CI. |

Astro caches rendered Markdown. After changing a file in `src/plugins/`, start the dev server once with `npm run dev -- --force` to see the effect on existing pages.
