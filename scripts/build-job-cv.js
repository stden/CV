const fs = require('node:fs/promises');
const path = require('node:path');
const { loadCvData, ROOT_DIR } = require('./lib/utils');
const { launchChromium } = require('./lib/browser');
const { prepareJobCv } = require('./lib/job-cv');
const { renderPdfHtml, printPdf } = require('./build-pdfs');

async function buildJobCv(specificationPath) {
    if (!specificationPath) throw new Error('Usage: npm run cv:job -- <vacancy.json>');
    const specification = JSON.parse(await fs.readFile(specificationPath, 'utf8'));
    const { data, variant } = prepareJobCv(loadCvData(), specification);
    const font = await fs.readFile(path.join(ROOT_DIR, 'assets', 'fonts', 'inter-latin-wght-normal.woff2'), 'base64');
    const html = renderPdfHtml(data, variant, font, { privateCv: true });
    const output = path.join(ROOT_DIR, 'applications');
    await fs.mkdir(output, { recursive: true });
    const directory = await fs.mkdtemp(path.join(output, variant.slug + '-'));
    try {
        const pdf = path.join(directory, variant.pdfFilename);
        await fs.writeFile(pdf.replace(/\.pdf$/, '.html'), html);
        await fs.writeFile(path.join(directory, 'vacancy.json'), JSON.stringify(specification, null, 2) + '\n');
        const browser = await launchChromium();
        try {
            await printPdf(await browser.newPage(), html, pdf);
        } finally {
            await browser.close();
        }
        console.log(pdf);
    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
}

buildJobCv(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
