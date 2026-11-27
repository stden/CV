import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonicalUrl, documentShell, escapeHtml } from './lib/html.mjs';
import { repoRoot } from './lib/content.mjs';
import { renderCvPage } from './render/cv-page.mjs';
import { renderHome } from './render/home.mjs';
import { renderProjectPage } from './render/project-page.mjs';
import { renderTechPage } from './render/tech-page.mjs';

// Every page the site serves. The list also feeds sitemap.xml, so a page cannot
// be published without being listed.
export function pageList(content) {
  return [
    { path: '', html: (c) => renderHome(c) },
    ...content.variants.map((variant) => ({ path: `cv/${variant.slug}/`, html: (c) => renderCvPage(c, variant) })),
    ...content.cv.projects.map((project) => ({ path: `projects/${project.id}/`, html: (c) => renderProjectPage(c, project) })),
    ...content.technologies.map((technology) => ({
      path: `tech/${technology.slug}.html`,
      html: (c) => renderTechPage(c, technology, existsSync(join(repoRoot, 'assets/images/tech', `${technology.slug}.svg`)))
    }))
  ];
}

function notFoundPage(content) {
  const body = `<section class="container section">
  <h1>Page not found</h1>
  <p>The page you were looking for is not here. <a href="./">Go to the CV</a>.</p>
</section>`;
  return documentShell({
    title: `Page not found — ${content.cv.name}`,
    description: 'The requested page does not exist.',
    pagePath: '404.html',
    prefix: '',
    site: content.site,
    body,
    bodyClass: 'page-404',
    ogType: 'website',
    robots: 'noindex'
  });
}

function sitemapXml(content, paths) {
  const urls = paths
    .map((path) => `  <url>\n    <loc>${escapeHtml(canonicalUrl(content.site, path))}</loc>\n    <lastmod>${content.site.updated}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}${site.basePath}sitemap.xml\n`;
}

function write(outputRoot, relativePath, text, written) {
  const target = join(outputRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  // Template indentation leaves spaces on blank lines; strip them so the output is clean.
  writeFileSync(target, text.replace(/[ \t]+$/gm, ''));
  written.push(relativePath);
}

export function buildSite(content, outputRoot = repoRoot) {
  const written = [];
  const pages = pageList(content);
  for (const page of pages) {
    const relativePath = page.path === '' || page.path.endsWith('/') ? `${page.path}index.html` : page.path;
    write(outputRoot, relativePath, page.html(content), written);
  }
  write(outputRoot, '404.html', notFoundPage(content), written);
  write(outputRoot, 'sitemap.xml', sitemapXml(content, pages.map((page) => page.path)), written);
  write(outputRoot, 'robots.txt', robotsTxt(content.site), written);
  write(outputRoot, '.nojekyll', '', written);
  return written;
}
