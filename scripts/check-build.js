const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ROOT_DIR, loadCvData } = require('./lib/utils');

function runBuild() {
    for (const script of ['build-project-diagrams.js', 'build-tech-pages.js', 'build-site.js']) {
        execFileSync(process.execPath, [path.join(ROOT_DIR, 'scripts', script)], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
        });
    }
}

function checkDataIntegrity(data) {
    assert.equal(data.profile.availability.showOpenToWork, false, 'Open-to-work banner must be disabled by default');
    const jsonText = JSON.stringify(data);
    assert.ok(!jsonText.includes('79117117850'), 'Phone number must not be present in data/cv.json');
    assert.ok(!jsonText.includes('vsevpluse.ru'), 'Dead domain vsevpluse.ru must not be present');
    assert.ok(!jsonText.includes('inruscom.com'), 'Repurposed domain inruscom.com must not be present');
    assert.equal(data.githubProjects.length, 6, 'Expected 6 selected GitHub projects');
    assert.equal(data.architectureDiagrams.length, 4, 'Expected 4 architecture diagrams');
    assert.equal(data.technologies.length, 20, 'Expected 20 technology pages');
    assert.deepEqual(data.variants.map(({ slug }) => slug), [
        'general', 'senior-java', 'distributed-systems', 'fintech-integrations', 'wise', 'ai-mcp', 'full',
    ]);
}

function collectHtmlPages(data) {
    return [
        'index.html',
        'cv/index.html',
        ...data.variants.map((v) => `cv/${v.slug}.html`),
        ...data.technologies.map((t) => `tech/${t.slug}.html`),
    ];
}

function checkHtmlPages(data, pages) {
    for (const page of pages) {
        const fullPath = path.join(ROOT_DIR, page);
        assert.ok(fs.existsSync(fullPath), `Missing generated HTML page: ${page}`);
        const html = fs.readFileSync(fullPath, 'utf8');
        const pageDir = path.dirname(fullPath);

        // SEO checks
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
        assert.ok(!html.includes('79117117850'), `${page} must not expose phone number`);

        // Asset & local link checks (zero root-relative /... references)
        for (const [, ref] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
            assert.ok(!ref.startsWith('/'), `${page} uses root-relative reference ${ref} which breaks under /CV/`);
            const local = decodeURIComponent(ref.split(/[?#]/)[0]);
            const target = path.resolve(pageDir, local);
            assert.ok(fs.existsSync(target), `${page} references missing local asset ${ref}`);
        }
    }

    // JSON-LD check on index.html
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const ldMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ldMatch, 'index.html must include JSON-LD structured data');
    const jsonLd = JSON.parse(ldMatch[1]);
    const types = (jsonLd['@graph'] || []).map((n) => n['@type']);
    assert.ok(types.includes('Person') && types.includes('ProfilePage'), 'JSON-LD must include Person and ProfilePage');
}

function checkAssetsAndDiscovery(data) {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'assets', 'fonts', 'inter-latin-wght-normal.woff2')), 'Self-hosted Inter font missing');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'assets', 'images', 'og-preview.png')), 'OG preview PNG missing');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'sitemap.xml')), 'sitemap.xml missing');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'robots.txt')), 'robots.txt missing');
    const sitemap = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes(`${data.site.baseUrl}/cv/wise.html`), 'sitemap.xml must include wise CV URL');
    for (const d of data.architectureDiagrams) {
        const svgPath = path.join(ROOT_DIR, 'assets', 'images', 'projects', `${d.slug}.svg`);
        assert.ok(fs.existsSync(svgPath), `Missing SVG diagram: ${d.slug}.svg`);
        const svg = fs.readFileSync(svgPath, 'utf8');
        assert.match(svg, /<svg[\s\S]*<title>/, `SVG ${d.slug}.svg must have <title>`);
    }
}

function checkPdfs(data) {
    for (const variant of data.variants) {
        const pdfPath = path.join(ROOT_DIR, 'assets', 'pdf', variant.pdfFilename);
        assert.ok(fs.existsSync(pdfPath), `Missing generated PDF: ${pdfPath}`);
        const header = fs.readFileSync(pdfPath).subarray(0, 5).toString('ascii');
        assert.equal(header, '%PDF-', `${variant.pdfFilename} must start with %PDF-`);

        const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
        const pagesMatch = info.match(/^Pages:\s+(\d+)/m);
        assert.ok(pagesMatch, `Could not read page count for ${variant.pdfFilename}`);
        const pages = Number(pagesMatch[1]);
        assert.ok(
            pages <= variant.expectedPages,
            `${variant.pdfFilename} has ${pages} pages, expected <= ${variant.expectedPages}`
        );

        const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
        for (const required of ['Denis Stepulenok', 'Kuehne+Nagel', 'Oracle', 'Taxify', 'Bolt', 'Tallinn', 'super.denis@gmail.com']) {
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
    }
}

function main() {
    runBuild();
    const data = loadCvData();
    checkDataIntegrity(data);
    const pages = collectHtmlPages(data);
    checkHtmlPages(data, pages);
    checkAssetsAndDiscovery(data);
    checkPdfs(data);
    console.log(`Static & PDF validation passed: ${pages.length} HTML pages, ${data.architectureDiagrams.length} SVG diagrams, ${data.variants.length} ATS PDFs.`);
}

main();
