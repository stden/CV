const fs = require('node:fs/promises');
const path = require('node:path');
const { loadCvData, ROOT_DIR } = require('./lib/utils');
const { launchChromium } = require('./lib/browser');
const {
    prepareJobCv,
    renderCoverLetterMarkdown,
    renderInterviewPrepMarkdown,
    renderMatchReportMarkdown,
    renderRecruiterQuestionsMarkdown,
} = require('./lib/job-cv');
const { parseMarkdownVacancy, slugify } = require('./lib/vacancy-matcher');
const { renderPdfHtml, printPdf } = require('./build-pdfs');

function stripHtmlToText(html) {
    return String(html ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchVacancyFromUrl(urlString) {
    if (!URL.canParse(urlString) || new URL(urlString).protocol !== 'https:') {
        throw new Error('Only HTTPS vacancy URLs are supported.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(urlString, {
            headers: { 'User-Agent': 'stden-cv-local-importer/1.0' },
            signal: controller.signal,
        });
        if (!res.ok) {
            throw new Error(`Could not retrieve vacancy URL (HTTP ${res.status}). Save the job description to a local .json or .md file and pass its path instead.`);
        }
        const body = await res.text();
        const text = /<html|<body/i.test(body) ? stripHtmlToText(body) : body.trim();
        if (text.length < 80) {
            throw new Error('Retrieved vacancy page had insufficient readable text. Save the job description locally as .json or .md instead.');
        }
        const host = new URL(urlString).hostname.replace(/^www\./, '');
        return {
            slug: slugify(`${host}-vacancy`),
            company: host,
            jobTitle: 'Senior Software Engineer',
            url: urlString,
            description: text.slice(0, 12000),
            requiredTechnologies: [],
            preferredTechnologies: [],
            requiredCompetencies: [],
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timed out fetching vacancy URL. Save the job description to a local .json or .md file and pass its path instead.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function readVacancySource(args) {
    const urlIdx = args.indexOf('--url');
    if (urlIdx >= 0) {
        const targetUrl = args[urlIdx + 1];
        if (!targetUrl) throw new Error('Usage: npm run cv:job -- --url <https-url>');
        return fetchVacancyFromUrl(targetUrl);
    }
    const specPath = args.find((a) => !a.startsWith('--'));
    if (!specPath) {
        throw new Error('Usage: npm run cv:job -- <vacancy.json|vacancy.md> [--out-dir <dir>]');
    }
    const raw = await fs.readFile(specPath, 'utf8');
    if (/\.(md|markdown|txt)$/i.test(specPath)) {
        return parseMarkdownVacancy(raw, slugify(path.basename(specPath, path.extname(specPath))));
    }
    return JSON.parse(raw);
}

async function buildJobCv(argv = process.argv.slice(2)) {
    const outIdx = argv.indexOf('--out-dir');
    const customOutDir = outIdx >= 0 ? argv[outIdx + 1] : null;
    const filteredArgs = argv.filter((_, i) => i !== outIdx && (outIdx < 0 || i !== outIdx + 1));

    const specification = await readVacancySource(filteredArgs);
    const cvData = loadCvData();
    const { data, variant, vacancy, matchResult } = prepareJobCv(cvData, specification);
    const font = await fs.readFile(path.join(ROOT_DIR, 'assets', 'fonts', 'inter-latin-wght-normal.woff2'), 'base64');
    const html = renderPdfHtml(data, variant, font, { privateCv: true });

    const baseOutput = customOutDir
        ? path.resolve(ROOT_DIR, customOutDir)
        : path.join(ROOT_DIR, 'applications');
    await fs.mkdir(baseOutput, { recursive: true });
    const directory = customOutDir
        ? baseOutput
        : await fs.mkdtemp(path.join(baseOutput, `${variant.slug}-`));

    try {
        const pdfPath = path.join(directory, 'resume.pdf');
        const htmlPath = path.join(directory, 'resume.html');
        await fs.writeFile(htmlPath, html);
        await fs.writeFile(path.join(directory, 'vacancy.json'), JSON.stringify(vacancy, null, 2) + '\n');
        await fs.writeFile(path.join(directory, 'cover-letter.md'), renderCoverLetterMarkdown(data, vacancy, matchResult));
        await fs.writeFile(path.join(directory, 'match-report.md'), renderMatchReportMarkdown(vacancy, matchResult));
        await fs.writeFile(path.join(directory, 'interview-preparation.md'), renderInterviewPrepMarkdown(data, vacancy, matchResult));
        await fs.writeFile(path.join(directory, 'questions-for-recruiter.md'), renderRecruiterQuestionsMarkdown(vacancy, matchResult));

        const browser = await launchChromium();
        try {
            await printPdf(await browser.newPage(), html, pdfPath);
        } finally {
            await browser.close();
        }
        console.log(directory);
        return directory;
    } catch (error) {
        if (!customOutDir) {
            await fs.rm(directory, { recursive: true, force: true });
        }
        throw error;
    }
}

if (require.main === module) {
    buildJobCv().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { buildJobCv, readVacancySource };
