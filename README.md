# Zenseact Research Blog
This repository contains the source code for the Zenseact Research Blog, which is hosted at [research.zenseact.com](https://research.zenseact.com). We aim to share our research and development efforts with the community, and we hope that you will find our blog posts interesting and useful. We also aim to **atleast upload the abstract for each paper we publish.**

We make use of [Jekyll](https://jekyllrb.com/) together with the theme [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/), which is a two-column responsive Jekyll theme perfect for powering your GitHub hosted blog.


## Make a new blog post
For each new paper that we submit, we should make a new blog post. To do this, follow these steps:
### Step 1
Create a new folder in `_publications` with the a name related to the paper. For example, if the paper is called "RAW or Cooked? Object detection using RAW images", then the folder could be called `raw-or-cooked`.

### Step 2
Create a new file in the folder called `raw-or-cooked.md`. This file could contain the following front matter (i.e, the metadata at the top of the markdown file):
```yaml
---
layout: publication
permalink: /publications/raw-or-cooked/ # This is the permalink to the blog post. It should be the same as the name of the folder.
title: Raw or Cooked? Object detection on RAW images # This is the title of the paper
venue: SCIA23 # This is the venue of the paper. It must have a corresponding entry in `_data/venues.yml`.
authors:
  - Ljungbergh
  - Johnander
  - Petersson
  - Felsberg
code: <link-to-potential-github-code>
doi: <digital object identifier> # This is the DOI, without protocol and domain, e.g., 10.1016/j.automatica.2023.111394
arxiv: https://arxiv.org/abs/2301.08965 # This is the arXiv link to the paper.
n_equal_contrib: 1 # This can be used if you have several authors that contributed equally to the paper. In this case, the first n authors listed in the `authors` field will be marked as equal contributors.
date: 2023-01-21 00:00:00 +0000 # This is the date of the paper submission
thumbnail-img: raw-or-cooked_thumbnail.png  # This is the thumbnail image that will be shown on the blog post. Next to the title.
---
```
Note here that you have to ensure two things:
1. All authors listed in the `authors` field must have a corresponding entry in `_data/authors.yml`.
2. The venue listed in the `venue` field must have a corresponding entry in `_data/venues.yml`.
Follow the convention in each of these files to add new authors and venues.

### Step 3
Add the abstract of your paper to the `raw-or-cooked.md` file. **Note** that you are of course free to add more content to the blog post, such as figures, videos, etc. However, the abstract is the only thing that is required. **Note** that you can include LaTeX equations in the blog post by using the correct syntax. See [this link](https://singyuan.github.io/posts/mathjax/add_tex/) for more information. You can also include citations in the blog post by using the correct syntax. See the `raw-or-cooked.md` file for an example, where the corresponding bibtex entries should be placed in `_bibliography/references.bib`.

### Step 4
You can preview your changes by running the site locally. To do this, simply run the following to build the docker image and serve the site locally:
```
docker compose build
docker compose up
```
Note that you only have to build the docker image once. After that, you can simply run `docker compose up` to serve the site locally. You can then preview the site at [http://http://0.0.0.0:8080/\<your-local-repo-dir>](http://http://0.0.0.0:8080/<your-local-repo-dir>).

### Step 5
Make a pull-request to this repository. Once the pull-request is merged, the blog post will be automatically published at [research.zenseact.com](https://research.zenseact.com).


## Add a new author
To add a new author, add a new entry to `_data/authors.yml`. Follow the convention in the file to add new authors.
```yaml
---
Ljungbergh: # this is the idientifier. should be unique.
  firstname: ["William", "W.", "W. L.", "William Ljungbergh"] # these are the first names of the author. Note that the order is important.
  github: wljungbergh # this is the authors github username (optional)
  linkedin: william-ljungbergh # this is the authors linkedin username (optional)
  mail: william.ljungbergh@zenseact.com # this is the authors email address (optional)
  org: [Zenseact, Linköping University] # these are the organizations that the author is affiliated with. Note that this does not have to be an array.
  picture: /assets/images/profiles/william_ljungbergh.jpg # This is a link to the authors profile picture. Should be a headshot. (optional)
  scholar: RXEPFo0AAAAJ # This is the authors Google Scholar ID. (optional)
  title: PhD Student # This is the authors title. [Phd Student, Researcher, Professor, Supervisor] (optional)
  url: https://ljungbergh.com # This is the authors personal website (optional)
  orcid: 0000-0002-0194-6346 # The Open Researcher and Contributor ID (optional)
```


## Add a new venue
To add a new venue, add a new entry to `_data/venues.yml`. Follow the convention in the file to add new venues.
```yaml
ICCV23: # identifier, should be unique
  # add the name of the conference/journal. This will be displayed on the blog post.
  name: International Conference on Computer Vision (ICCV), 2023
  # add the url to the conference (optional)
  url: https://iccv2023.thecvf.com
```
