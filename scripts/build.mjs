// Entry point for `npm run build`: validate the content, then write the pages,
// diagrams and PDFs. Pass --no-pdf to skip the browser step.
import { buildDiagrams } from './build-diagrams.mjs';
import { buildPdfs } from './build-pdfs.mjs';
import { buildSite } from './build-site.mjs';
import { loadContent } from './lib/content.mjs';
import { assertValidContent } from './lib/validate.mjs';

const content = loadContent();
assertValidContent(content);

const written = [...buildDiagrams(content.architecture), ...buildSite(content)];
console.log(`Wrote ${written.length} files (pages, diagrams, sitemap, robots).`);

if (process.argv.includes('--no-pdf')) {
  console.log('Skipped PDF generation (--no-pdf).');
} else {
  const pdfs = await buildPdfs(content);
  console.log(`Wrote ${pdfs.length} PDF files: ${pdfs.join(', ')}`);
}
