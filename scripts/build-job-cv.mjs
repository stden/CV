import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { printResume } from './build-pdfs.mjs';
import { loadContent, repoRoot } from './lib/content.mjs';
import { prepareJobCv } from './lib/job-cv.mjs';
import { renderCvPage } from './render/cv-page.mjs';

async function buildJobCv(specificationPath) {
  if (!specificationPath) throw new Error('Usage: npm run cv:job -- <vacancy.json>');
  const specification = JSON.parse(await readFile(specificationPath, 'utf8'));
  const { content, variant } = prepareJobCv(loadContent(), specification);
  const css = await readFile(join(repoRoot, 'assets/css/site.css'), 'utf8');
  const font = await readFile(join(repoRoot, 'assets/fonts/inter-latin.woff2'), 'base64');
  const stylesheet = css.replace('../fonts/inter-latin.woff2', `data:font/woff2;base64,${font}`);
  const output = join(repoRoot, 'applications');
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(join(output, variant.slug + '-'));

  try {
    const html = join(directory, variant.pdf.replace(/\.pdf$/, '.html'));
    const pdf = join(directory, variant.pdf);
    await writeFile(html, renderCvPage(content, variant, { stylesheet }));
    await writeFile(join(directory, 'vacancy.json'), JSON.stringify(specification, null, 2) + '\n');
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
    try {
      await printResume(await browser.newPage(), pathToFileURL(html).href, pdf);
    } finally {
      await browser.close();
    }
    console.log(pdf);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

buildJobCv(process.argv[2]).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
