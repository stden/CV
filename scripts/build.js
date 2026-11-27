const fs = require('node:fs');
const path = require('node:path');
const { cv, catalogue, variants } = require('../src/cv-data');
const { siteUrl, escapeHtml } = require('../src/html');
const { renderPortfolio } = require('../src/portfolio');
const { renderResume } = require('../src/resume');
const { buildPdfs } = require('./build-pdfs');
const { writeTechPages } = require('./build-tech-pages');
const { writeProjectDiagrams } = require('./build-project-diagrams');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

function copy(source, destination) {
    fs.cpSync(path.join(root, source), path.join(dist, destination), { recursive: true });
}

function write(file, content) {
    fs.writeFileSync(path.join(dist, file), content);
}

function writeSitemap(techNames) {
    const routes = ['', ...variants.map(({ slug }) => `cv/${slug}/`), ...techNames.map((name) => `tech/${name}`)];
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${escapeHtml(new URL(route, siteUrl).href)}</loc></url>`).join('\n')}
</urlset>
`);
    write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
}

async function build() {
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(assets, { recursive: true });
    copy('favicon.ico', 'favicon.ico');
    copy('whatsapp.html', 'whatsapp.html');
    copy('assets/social-preview.jpg', 'assets/social-preview.jpg');
    copy('assets/images/photo.jpg', 'assets/images/photo.jpg');
    copy('assets/images/tech', 'assets/images/tech');
    copy('src/portfolio.css', 'assets/portfolio.css');
    copy('src/portfolio-client.js', 'assets/portfolio.js');
    copy('src/resume.css', 'assets/resume.css');
    copy('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'assets/inter-latin.woff2');
    copy('node_modules/@fontsource-variable/inter/LICENSE', 'assets/inter-LICENSE.txt');

    const overview = { ...cv, skills: cv.skills.map((group) => ({ ...group, items: group.items.slice(0, 12) })) };
    write('index.html', renderPortfolio(overview, variants));
    write('skills.json', JSON.stringify(catalogue, null, 2) + '\n');
    write('.nojekyll', '');

    const techDirectory = path.join(dist, 'tech');
    writeTechPages(techDirectory);
    writeProjectDiagrams(path.join(assets, 'images', 'projects'), [...cv.projects, cv.backgroundProcessing]);
    for (const variant of variants) {
        const directory = `cv/${variant.slug}`;
        fs.mkdirSync(path.join(dist, directory), { recursive: true });
        write(`${directory}/index.html`, renderResume(cv, variant));
    }
    writeSitemap(fs.readdirSync(techDirectory));
    if (!process.argv.includes('--html-only')) await buildPdfs();
    console.log(`Built ${variants.length} CV versions and portfolio in dist/.`);
}

build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
