const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepareJobCv } = require('../src/job-cv');
const { renderResume } = require('../src/resume');
const { printResume } = require('./build-pdfs');

const root = path.resolve(__dirname, '..');

async function buildJobCv(specificationPath) {
    if (!specificationPath) throw new Error('Usage: npm run cv:job -- <vacancy.json>');
    const specification = JSON.parse(await readFile(specificationPath, 'utf8'));
    const { cv, variant } = prepareJobCv(specification);
    const stylesheet = await readFile(path.join(root, 'src', 'resume.css'), 'utf8');
    const output = path.join(root, 'applications');
    await mkdir(output, { recursive: true });
    const directory = await mkdtemp(path.join(output, variant.slug + '-'));
    try {
        const html = path.join(directory, variant.filename.replace(/\.pdf$/, '.html'));
        const pdf = path.join(directory, variant.filename);
        await writeFile(html, renderResume(cv, variant, { stylesheet }));
        await writeFile(path.join(directory, 'vacancy.json'), JSON.stringify(specification, null, 2) + '\n');
        const browser = await chromium.launch();
        try {
            await printResume(await browser.newPage(), html, pdf);
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
