// The Jekyll site served these pages at /publications.html and /research.html.
// GitHub Pages cannot send real redirects, so each old address gets a page that forwards to the new one.
import type { APIRoute, GetStaticPaths } from 'astro';

export const getStaticPaths = (() =>
  ['publications', 'research'].map((page) => ({ params: { page } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, site }) => {
  const target = new URL(`/${params.page}/`, site).href;
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Redirecting</title>` +
      `<link rel="canonical" href="${target}"><meta name="robots" content="noindex">` +
      // The script keeps a ?topic= filter from old links; the refresh is for when scripts do not run.
      `<script>location.replace('/${params.page}/' + location.search + location.hash)</script>` +
      `<meta http-equiv="refresh" content="0; url=${target}"><a href="${target}">${target}</a>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
};
