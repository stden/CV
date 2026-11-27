import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { loadContent, repoRoot } from '../scripts/lib/content.mjs';

// Checks the generated PDFs with poppler (pdfinfo, pdftotext). CI installs
// poppler-utils; on a machine without it these tests are skipped with a notice.
const content = loadContent();
const downloads = join(repoRoot, 'downloads');

function hasPoppler() {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const skip = hasPoppler() ? false : 'poppler-utils is not installed';

function pageCount(file) {
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  return Number(info.match(/^Pages:\s+(\d+)/m)[1]);
}

// Line breaks and capital letters (headings are set in capitals by CSS) do not change the content.
function text(file) {
  return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ').toLowerCase();
}

describe('generated PDF resumes', { skip }, () => {
  test('every variant has a PDF that exists', () => {
    for (const variant of content.variants) {
      assert.ok(existsSync(join(downloads, variant.pdf)), `${variant.pdf} is missing`);
    }
  });

  test('targeted versions fit on two A4 pages, the full CV on three', () => {
    for (const variant of content.variants) {
      const pages = pageCount(join(downloads, variant.pdf));
      const limit = variant.slug === 'full' ? 3 : 2;
      assert.ok(pages <= limit, `${variant.pdf} has ${pages} pages, limit ${limit}`);
    }
  });

  test('the text is selectable: name, title, email and employers can be extracted', () => {
    for (const variant of content.variants) {
      const extracted = text(join(downloads, variant.pdf));
      assert.ok(extracted.includes('denis stepulenok'), `${variant.pdf}: name missing`);
      assert.ok(extracted.includes(variant.title.toLowerCase()), `${variant.pdf}: title missing`);
      assert.ok(extracted.includes('super.denis@gmail.com'), `${variant.pdf}: email missing`);
      assert.ok(extracted.includes('kuehne+nagel'), `${variant.pdf}: Kuehne+Nagel missing`);
      assert.ok(extracted.includes('taxify (now bolt)'), `${variant.pdf}: Taxify missing`);
    }
  });

  test('no template placeholders leak into the PDF text', () => {
    for (const variant of content.variants) {
      const extracted = text(join(downloads, variant.pdf));
      assert.ok(!/undefined|null|\[object|\{\{/.test(extracted), `${variant.pdf} contains a template leak`);
    }
  });

  test('links are kept as PDF link annotations', () => {
    for (const variant of content.variants) {
      const bytes = readFileSync(join(downloads, variant.pdf), 'latin1');
      assert.ok(bytes.includes('/URI'), `${variant.pdf} has no clickable links`);
    }
  });

  test('the Full CV lists earlier employers and the education block', () => {
    const extracted = text(join(downloads, 'Denis-Stepulenok-Full-CV.pdf'));
    assert.ok(extracted.includes('earlier experience'));
    assert.ok(extracted.includes('leti'));
    assert.ok(extracted.includes('research & engineering center'));
  });
});
