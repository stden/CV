const { mkdir, stat } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { variants } = require('../src/cv-data');

const dist = path.resolve(__dirname, '..', 'dist');

async function buildPdfs() {
    const directory = path.join(dist, 'downloads');
    await mkdir(directory, { recursive: true });
    try {
        await stat(path.join(dist, 'cv', variants[0].slug, 'index.html'));
    } catch {
        throw new Error('Build the HTML before generating PDFs: npm run build:html');
    }
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        for (const variant of variants) {
            const source = path.join(dist, 'cv', variant.slug, 'index.html');
            await page.goto(pathToFileURL(source).href);
            await page.evaluate(() => document.fonts.ready);
            await page.pdf({
                path: path.join(directory, variant.filename),
                preferCSSPageSize: true,
                tagged: true,
            });
        }
    } finally {
        await browser.close();
    }
    console.log(`Generated ${variants.length} A4 PDF resumes.`);
}

if (require.main === module) {
    buildPdfs().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
module.exports = { buildPdfs };
