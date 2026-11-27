const fs = require('node:fs/promises');
const path = require('node:path');
const { loadCvData, ROOT_DIR } = require('./lib/utils');
const { launchChromium } = require('./lib/browser');
const { prepareJobCv } = require('./lib/job-cv');
const { importVacancy, VacancyError } = require('./lib/vacancy');
const { renderApplicationDocuments } = require('./lib/application-documents');
const { renderPdfHtml, printPdf } = require('./build-pdfs');

async function applicationDirectory() {
    const root = path.join(ROOT_DIR, 'applications');
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const info = await fs.lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new VacancyError('The applications directory must be a local directory inside the checkout.');
    }
    return fs.mkdtemp(path.join(root, 'application-'));
}

async function buildJobCv(input) {
    const specification = await importVacancy(input);
    const { data, variant, vacancy, match } = prepareJobCv(loadCvData(), specification);
    const font = await fs.readFile(path.join(ROOT_DIR, 'assets', 'fonts', 'inter-latin-wght-normal.woff2'), 'base64');
    const html = renderPdfHtml(data, variant, font, { privateCv: true });
    const files = {
        'resume.html': html,
        'vacancy.json': JSON.stringify(vacancy, null, 2) + '\n',
        ...renderApplicationDocuments(data, variant, vacancy, match),
    };

    const directory = await applicationDirectory();
    try {
        for (const [name, contents] of Object.entries(files)) {
            await fs.writeFile(path.join(directory, name), contents, { mode: 0o600, flag: 'wx' });
        }
        const browser = await launchChromium();
        try {
            const page = await browser.newPage({ serviceWorkers: 'block' });
            await page.route('**/*', (route) => route.abort());
            const pdf = path.join(directory, 'resume.pdf');
            await printPdf(page, html, pdf);
            await fs.chmod(pdf, 0o600);
        } finally {
            await browser.close();
        }
        return path.relative(ROOT_DIR, directory);
    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
}

if (require.main === module) {
    buildJobCv(process.argv[2]).then((directory) => {
        console.log(`Private application package saved in ${directory}`);
    }).catch((error) => {
        console.error(error instanceof VacancyError ? error.message : 'Could not generate the private package. Verify that the CV files, fonts and Chromium are available.');
        process.exitCode = 1;
    });
}

module.exports = { buildJobCv };
