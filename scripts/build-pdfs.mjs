import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { repoRoot } from './lib/content.mjs';
import { startStaticServer } from './lib/static-server.mjs';

// Prints each CV page to A4 PDF with Chromium. The browser reads the same HTML
// and print CSS as the web page, so the PDF text is selectable and the links work.
const FOOTER = `<div style="width:100%;font-size:8px;color:#555;text-align:center;font-family:sans-serif;">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`;

export async function printResume(page, url, path) {
  await page.goto(url, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path,
    format: 'A4',
    printBackground: false,
    margin: { top: '14mm', right: '16mm', bottom: '16mm', left: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: FOOTER
  });
}

export async function buildPdfs(content, siteRoot = repoRoot) {
  const outputDirectory = join(siteRoot, 'downloads');
  mkdirSync(outputDirectory, { recursive: true });
  const server = await startStaticServer(siteRoot);
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage();
    for (const variant of content.variants) {
      await printResume(page, `http://127.0.0.1:${port}/cv/${variant.slug}/`, join(outputDirectory, variant.pdf));
    }
  } finally {
    await browser.close();
    server.close();
  }
  return content.variants.map((variant) => `downloads/${variant.pdf}`);
}
