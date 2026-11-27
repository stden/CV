const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ROOT_DIR, loadCvData } = require('./lib/utils');
const { availableLanguages, contentRoutes, publicFiles } = require('./lib/public-artifact');
const { localeCodes, loadLocales, localize, localizedPath, localizedPdfName } = require('./lib/i18n');
const { FONT_SUBSETS } = require('./lib/fonts');
const { withValidatedPublicArtifact } = require('./stage-public');
const { ConfidentialityCheckError } = require('./check-confidentiality');

function runBuild() {
    for (const script of ['build-project-diagrams.js', 'build-tech-pages.js', 'build-site.js', 'build-profile.js', 'build-articles.js']) {
        execFileSync(process.execPath, [path.join(ROOT_DIR, 'scripts', script)], {
            cwd: ROOT_DIR,
            stdio: 'pipe',
        });
    }
}

function checkDataIntegrity(data) {
    assert.equal(data.profile.availability.showOpenToWork, false, 'Open-to-work banner must be disabled by default');
    assert.equal(data.githubProjects.length, 6, 'Expected 6 selected GitHub projects');
    assert.equal(data.architectureDiagrams.length, 4, 'Expected 4 architecture diagrams');
    assert.equal(data.technologies.length, 20, 'Expected 20 technology pages');
    assert.deepEqual(data.variants.map(({ slug }) => slug), [
        'general', 'senior-java', 'distributed-systems', 'fintech-integrations', 'wise', 'ai-mcp', 'full',
    ]);
}

function checkHtmlPages(data, pages) {
    for (const page of pages) {
        const fullPath = path.join(ROOT_DIR, page);
        assert.ok(fs.existsSync(fullPath), `Missing generated HTML page: ${page}`);
        const html = fs.readFileSync(fullPath, 'utf8');
        const pageDir = path.dirname(fullPath);
        const code = localeCodes.includes(page.split('/')[0]) ? page.split('/')[0] : 'en';
        const relative = code === 'en' ? page : page.slice(3);
        const route = relative === 'index.html' || (/\/index\.html$/.test(relative) && relative !== 'cv/index.html')
            ? relative.slice(0, -'index.html'.length) : relative;
        assert.ok(html.includes(`<html lang="${code}">`), 'PUBLIC_LANGUAGE_MISSING');
        assert.ok(html.includes(`<link rel="canonical" href="${data.site.baseUrl}/${localizedPath(code, route)}">`), 'PUBLIC_LANGUAGE_CANONICAL');
        const alternate = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
        assert.deepEqual(alternate.map(([, lang, href]) => [lang, href]), [
            ...availableLanguages(route).map((lang) => [lang, `${data.site.baseUrl}/${localizedPath(lang, route)}`]),
            ['x-default', `${data.site.baseUrl}/${route}`],
        ], 'PUBLIC_LANGUAGE_ALTERNATES');

        assert.match(html, /<title>[^<]+<\/title>/, `${page} must have a <title>`);
        assert.match(html, /<meta name="description" content="[^"]+">/, `${page} must have a meta description`);
        assert.match(
            html,
            new RegExp(`<link rel="canonical" href="${data.site.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
            `${page} must have canonical URL under ${data.site.baseUrl}/`
        );
        const h1Count = (html.match(/<h1\b/g) || []).length;
        assert.equal(h1Count, 1, `${page} must have exactly one <h1>, found ${h1Count}`);
        assert.ok(!html.includes('level-bar-inner'), `${page} must not include skill percentage bars`);

        for (const [, ref] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
            assert.ok(!ref.startsWith('/'), `${page} uses root-relative reference ${ref} which breaks under /CV/`);
            const local = decodeURIComponent(ref.split(/[?#]/)[0]);
            const target = path.resolve(pageDir, local);
            assert.ok(fs.existsSync(target), `${page} references missing local asset ${ref}`);
        }
    }

    for (const code of localeCodes) {
        const index = fs.readFileSync(path.join(ROOT_DIR, localizedPath(code, 'index.html')), 'utf8');
        const ldMatch = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        assert.ok(ldMatch, 'PUBLIC_PROFILE_SCHEMA_MISSING');
        const { '@graph': graph } = JSON.parse(ldMatch[1]);
        assert.ok(graph.some((entry) => entry['@type'] === 'Person'), 'PUBLIC_PERSON_SCHEMA_MISSING');
        assert.ok(graph.some((entry) => entry['@type'] === 'ProfilePage' && entry.inLanguage === code), 'PUBLIC_PROFILE_SCHEMA_LANGUAGE');
    }
}

function checkAssetsAndDiscovery(data) {
    for (const { filename } of FONT_SUBSETS) {
        assert.ok(fs.existsSync(path.join(ROOT_DIR, 'assets', 'fonts', filename)), 'PUBLIC_FONT_MISSING');
    }
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'assets', 'images', 'og-preview.png')), 'OG preview PNG missing');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'sitemap.xml')), 'sitemap.xml missing');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'robots.txt')), 'robots.txt missing');
    const sitemap = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes(`${data.site.baseUrl}/cv/wise.html`), 'sitemap.xml must include wise CV URL');
    for (const code of localeCodes) {
        for (const route of contentRoutes(data, code)) {
            assert.ok(sitemap.includes(`<loc>${data.site.baseUrl}/${localizedPath(code, route)}</loc>`), 'PUBLIC_SITEMAP_DETAIL_MISSING');
        }
        for (const diagram of data.architectureDiagrams) {
            const svgPath = path.join(ROOT_DIR, 'assets', 'images', 'projects', localizedPath(code, diagram.slug + '.svg'));
            const svg = fs.readFileSync(svgPath, 'utf8');
            assert.ok(svg.includes(`xml:lang="${code}"`), 'PUBLIC_DIAGRAM_LANGUAGE');
            assert.match(svg, /<svg[\s\S]*<title>/, 'PUBLIC_DIAGRAM_TITLE');
        }
    }
}

function checkPdfs(data, code = 'en', variants = data.variants) {
    for (const variant of variants) {
        const pdfPath = path.join(ROOT_DIR, 'assets', 'pdf', variant.pdfFilename);
        assert.ok(fs.existsSync(pdfPath), `Missing generated PDF: ${pdfPath}`);
        const bytes = fs.readFileSync(pdfPath);
        assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-', 'PUBLIC_PDF_HEADER');
        assert.ok(bytes.includes(Buffer.from(`/Lang (${code})`)), 'PUBLIC_PDF_LANGUAGE');

        const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
        assert.match(info, /^Page size:\s+[^\n]+\(A4\)/m, 'PUBLIC_PDF_FORMAT');
        assert.match(info, /^Title:\s+\S+/m, 'PUBLIC_PDF_METADATA');
        assert.match(info, /^Tagged:\s+yes$/m, 'PUBLIC_PDF_TAGGED');
        const pagesMatch = info.match(/^Pages:\s+(\d+)/m);
        assert.ok(pagesMatch, `Could not read page count for ${variant.pdfFilename}`);
        const pages = Number(pagesMatch[1]);
        assert.ok(
            pages <= variant.expectedPages,
            `${variant.pdfFilename} has ${pages} pages, expected <= ${variant.expectedPages}`
        );

        const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
        for (const required of ['Denis Stepulenok', 'Kuehne+Nagel', 'Oracle', 'Taxify', 'Bolt', data.profile.location.split(',')[0], data.profile.contact.email]) {
            assert.ok(text.includes(required), `${variant.pdfFilename} extracted text missing "${required}"`);
        }
        if (variant.slug === 'general') {
            assert.equal(pages, 2, 'General CV must have two pages');
            const normalizedText = text.replace(/\s+/g, ' ');
            for (const { company } of data.experience) {
                assert.ok(normalizedText.includes(company), `General CV is missing employer "${company}"`);
            }
        }
        assert.ok(!/\b9[0-9]%\b/.test(text), `${variant.pdfFilename} must not contain arbitrary skill percentage bars`);
        const headingKeys = ['pdf.summary', 'pdf.skills', 'experience.section', 'common.education', 'common.languages'];
        for (const heading of headingKeys.map((key) => data.t(`ui.${key}`))) {
            assert.ok(text.toLowerCase().includes(heading.toLowerCase()), 'PUBLIC_PDF_HEADING_MISSING');
        }
        const links = execFileSync('pdfinfo', ['-url', pdfPath], { encoding: 'utf8' });
        for (const href of [`mailto:${data.profile.contact.email}`, data.profile.contact.github, data.profile.contact.linkedin]) {
            assert.ok(links.includes(href), 'PUBLIC_PDF_LINK_MISSING');
        }
        const fonts = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' }).trim().split('\n').slice(2);
        assert.ok(fonts.length && fonts.every((line) => /\byes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+$/.test(line.trim())), 'PUBLIC_PDF_FONT_NOT_EMBEDDED');
        if (code === 'ru') assert.match(text, /[А-Яа-яЁё]{6}/u, 'PUBLIC_PDF_CYRILLIC_TEXT');
        if (code === 'et' || code === 'de') assert.match(text, /[äöüõšžß]/iu, 'PUBLIC_PDF_LOCAL_TEXT');
        checkPdfBounds(pdfPath, pages);
    }
}

function checkPdfBounds(pdfPath, count) {
    const layout = execFileSync('pdftotext', ['-bbox-layout', pdfPath, '-'], { encoding: 'utf8' });
    const pages = [...layout.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
    assert.equal(pages.length, count, 'PUBLIC_PDF_TEXT_PAGE_MISSING');
    for (const [, width, height, page] of pages) {
        const words = [...page.matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">/g)];
        assert.ok(words.length, 'PUBLIC_PDF_PAGE_EMPTY');
        for (const [, x0, y0, x1, y1] of words) {
            assert.ok(+x0 >= 0 && +y0 >= 0 && +x1 <= +width && +y1 <= +height, 'PUBLIC_PDF_TEXT_OUTSIDE_PAGE');
        }
    }
}

function main() {
    runBuild();
    const data = loadCvData();
    checkDataIntegrity(data);
    withValidatedPublicArtifact(data, () => {});
    const files = publicFiles(data);
    const pages = files.filter((file) => file.endsWith('.html'));
    checkHtmlPages(data, pages);
    checkAssetsAndDiscovery(data);
    const dictionaries = loadLocales(data);
    for (const code of localeCodes) {
        const localized = localize(data, code, dictionaries[code]);
        const general = localized.variants.find(({ slug }) => slug === 'general');
        const variants = [{ ...general, pdfFilename: localizedPdfName(code) }];
        if (code === 'en') variants.push(...localized.variants);
        checkPdfs(localized, code, variants);
    }
    const count = (extension) => files.filter((file) => file.endsWith(extension)).length;
    console.log(`Static & PDF validation passed: ${pages.length} HTML pages, ${data.architectureDiagrams.length * localeCodes.length} architecture SVG diagrams, ${count('.pdf')} ATS PDFs.`);
}

try {
    main();
} catch (error) {
    const safe = error instanceof ConfidentialityCheckError || /^PUBLIC_[A-Z_]+$/.test(error.message);
    console.error(safe ? error.message : 'PUBLIC_BUILD_OR_VALIDATION_FAILED');
    process.exitCode = 1;
}
