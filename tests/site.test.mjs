import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { buildDiagrams } from '../scripts/build-diagrams.mjs';
import { buildSite, pageList } from '../scripts/build-site.mjs';
import { loadContent, repoRoot } from '../scripts/lib/content.mjs';

// The site is built into a temporary directory, so the tests never touch the
// committed output. Assets are copied in the same way GitHub Pages sees them.
const content = loadContent();
const origin = `${content.site.origin}${content.site.basePath}`;
let out;
let pages;

before(() => {
  out = mkdtempSync(join(tmpdir(), 'cv-site-'));
  cpSync(join(repoRoot, 'assets'), join(out, 'assets'), { recursive: true });
  cpSync(join(repoRoot, 'favicon.ico'), join(out, 'favicon.ico'));
  buildDiagrams(content.architecture, out);
  buildSite(content, out);
  pages = pageList(content).map((page) => (page.path === '' || page.path.endsWith('/') ? `${page.path}index.html` : page.path));
});

after(() => {
  rmSync(out, { recursive: true, force: true });
});

const read = (relativePath) => readFileSync(join(out, relativePath), 'utf8');
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const textOf = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

function attributeValues(html) {
  return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
}

function checkLink(page, value) {
  if (/^(https?:|mailto:|tel:|data:)/.test(value)) return;
  assert.ok(!value.startsWith('/'), `${page} uses a root-relative link ${value}; it breaks under /CV/`);
  const [pathPart, fragment] = value.split('#');
  if (pathPart === '') {
    assert.ok(fragment === undefined || read(page).includes(`id="${fragment}"`), `${page} links to missing #${fragment}`);
    return;
  }
  const base = dirname(join(out, page));
  const target = resolve(base, decodeURIComponent(pathPart));
  const exists = existsSync(target) || (target.endsWith('/') && existsSync(join(target, 'index.html')));
  const isDownload = pathPart.startsWith('downloads/') || pathPart.includes('/downloads/');
  if (isDownload) {
    assert.ok(existsSync(join(repoRoot, 'downloads', pathPart.split('/').pop())), `${page} links to missing PDF ${pathPart}`);
    return;
  }
  assert.ok(exists, `${page} links to missing ${value}`);
  if (fragment && target.endsWith('.html')) {
    assert.ok(readFileSync(target, 'utf8').includes(`id="${fragment}"`), `${page} links to missing #${fragment} in ${pathPart}`);
  }
}

describe('built pages', () => {
  test('every page is written and listed in the sitemap', () => {
    for (const page of pages) assert.ok(existsSync(join(out, page)), `${page} not written`);
    const sitemap = read('sitemap.xml');
    for (const page of pageList(content)) {
      assert.ok(sitemap.includes(`<loc>${origin}${page.path}</loc>`), `${page.path} missing from sitemap`);
    }
  });

  test('the social preview image used by Open Graph and Twitter exists', () => {
    assert.ok(existsSync(join(out, 'assets/images/social-card.png')));
    assert.ok(read('index.html').includes(`<meta property="og:image" content="${origin}assets/images/social-card.png">`));
  });

  test('robots.txt points at the sitemap', () => {
    assert.match(read('robots.txt'), new RegExp(`Sitemap: ${origin.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}sitemap\\.xml`));
  });

  test('every internal link and anchor resolves, with no root-relative links', () => {
    for (const page of pages) {
      for (const value of attributeValues(read(page))) checkLink(page, value);
    }
  });

  test('each page has one h1, a title, a description and a canonical URL for its own path', () => {
    for (const page of pages) {
      const html = read(page);
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${page} must have exactly one h1`);
      assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
      assert.match(html, /<meta name="description" content="[^"]+">/, `${page} has no description`);
      const expected = `${origin}${page.replace(/index\.html$/, '')}`;
      if (page !== '404.html') assert.ok(html.includes(`<link rel="canonical" href="${expected}">`), `${page} canonical is not ${expected}`);
    }
  });

  test('structured data is valid JSON on every page that declares it', () => {
    for (const page of pages) {
      for (const [, json] of read(page).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        assert.doesNotThrow(() => JSON.parse(json), `${page} has invalid JSON-LD`);
      }
    }
  });

  test('the home page has the seven navigation sections and every one of them exists', () => {
    const home = read('index.html');
    for (const id of ['overview', 'experience', 'projects', 'skills', 'architecture', 'education', 'contact']) {
      assert.ok(home.includes(`href="#${id}"`), `nav is missing #${id}`);
      assert.ok(home.includes(`id="${id}"`), `section #${id} is missing`);
    }
  });

  test('the hero shows the agreed title, location and the Download CV button', () => {
    const text = textOf(read('index.html'));
    assert.ok(text.includes('Senior Software Engineer | Java, Distributed Systems & AI Engineering'));
    assert.ok(text.includes('Tallinn, Estonia'));
    assert.ok(read('index.html').includes('href="downloads/Denis-Stepulenok-Full-CV.pdf"'));
  });

  test('open-to-work is not shown by default', () => {
    assert.ok(!textOf(read('index.html')).includes('Open to senior backend'));
    assert.ok(!read('index.html').includes('class="availability"'));
  });

  test('no skill percentages or proficiency bars are rendered', () => {
    for (const page of pages) {
      const html = read(page);
      assert.ok(!/level-bar|data-level/.test(html), `${page} still renders proficiency bars`);
      assert.ok(!/\d\s?%/.test(textOf(html)), `${page} shows a percentage`);
    }
  });

  test('Kuehne+Nagel is listed first and marked as the current role', () => {
    const home = read('index.html');
    const first = home.indexOf('Kuehne+Nagel');
    const taxify = home.indexOf('Taxify (now Bolt)');
    assert.ok(first > 0 && first < taxify);
    assert.ok(home.includes('Current role'));
  });

  test('every targeted CV page links to its PDF and the PDF file exists', () => {
    for (const variant of content.variants) {
      const html = read(`cv/${variant.slug}/index.html`);
      assert.ok(html.includes(`href="../../downloads/${variant.pdf}"`), `${variant.slug} has no link to ${variant.pdf}`);
      assert.ok(existsSync(join(repoRoot, 'downloads', variant.pdf)), `${variant.pdf} has not been generated`);
    }
  });

  test('skills outside any job are labelled Other skills in the resume', () => {
    const java = read('cv/senior-java-backend/index.html');
    assert.ok(java.includes('<strong>Other skills:</strong>'));
    assert.ok(java.includes('Apache Kafka'));
  });

  test('the Wise CV does not claim fintech, AML or payment experience', () => {
    const wise = textOf(read('cv/wise/index.html')).toLowerCase();
    for (const term of ['aml', 'payment', 'fintech', 'compliance', 'kyc']) {
      assert.ok(!wise.includes(term), `wise CV mentions ${term}`);
    }
  });

  test('case studies show the architecture diagram and every technology page keeps its title', () => {
    for (const project of content.cv.projects) {
      const html = read(`projects/${project.id}/index.html`);
      assert.ok(html.includes(`<h1 id="case-title">`));
      assert.ok(html.includes('Technical challenges') && html.includes('Design decisions') && html.includes('Reliability considerations'));
      assert.ok(html.includes('Results'));
    }
    for (const technology of content.technologies) {
      assert.ok(read(`tech/${technology.slug}.html`).includes(technology.title));
    }
  });

  test('the 404 page is not indexed', () => {
    assert.ok(read('404.html').includes('<meta name="robots" content="noindex">'));
  });
});
