const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cv, catalogue, variants } = require('../src/cv-data');
const { siteUrl } = require('../src/html');

const root = path.resolve(__dirname, '../dist');
const base = new URL(siteUrl);
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });
const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const references = (html) => [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);

function localTarget(url) {
    assert.ok(url.pathname.startsWith(base.pathname), `URL is outside the Pages base: ${url.href}`);
    const file = path.join(root, decodeURIComponent(url.pathname.slice(base.pathname.length)));
    return fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
}

function checkHtml(file) {
    const relative = path.relative(root, file);
    const url = new URL(relative, base);
    const html = fs.readFileSync(file, 'utf8');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate HTML ID in ${relative}`);
    for (const reference of references(html)) {
        assert.doesNotMatch(reference, /(?:jquery[^/]*\.js|assets\/plugins\/bootstrap)/i, `Legacy dependency in ${relative}`);
        const link = new URL(reference, url);
        if (link.origin !== base.origin) continue;
        const target = localTarget(link);
        assert.ok(fs.statSync(target).isFile(), `${relative} references missing ${reference}`);
        if (link.hash && target.endsWith('.html')) {
            const targetHtml = target === file ? html : fs.readFileSync(target, 'utf8');
            assert.ok(targetHtml.includes(`id="${decodeURIComponent(link.hash.slice(1))}"`), `Missing anchor ${reference} from ${relative}`);
        }
    }
    assert.match(html, /<title>[^<]+<\/title>/, `${relative} needs a page title`);
    assert.match(html, /rel="canonical" href="https:\/\/stden\.github\.io\/CV\//, `${relative} needs a canonical URL`);
    const social = html.match(/property="og:image" content="([^"]+)"/)?.[1];
    if (social) assert.ok(fs.statSync(localTarget(new URL(social))).isFile());
    assert.ok(!/<!--\[if (?:lt )?IE/i.test(html), `Legacy IE conditionals in ${relative}`);
}

function checkSkills() {
    const groups = new Set(catalogue.groups.map(({ id }) => id));
    const ids = new Set();
    const roles = new Set(cv.experience.map(({ id }) => id));
    const projects = new Set(cv.projects.map(({ id }) => id));
    assert.equal(catalogue.version, 1);
    assert.equal(groups.size, catalogue.groups.length);
    assert.deepEqual(JSON.parse(read('skills.json')), catalogue);
    for (const skill of catalogue.skills) {
        assert.match(skill.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(!ids.has(skill.id), `Duplicate skill ${skill.id}`);
        ids.add(skill.id);
        assert.ok(skill.name.trim() && groups.has(skill.group) && skill.evidence.length, `Incomplete skill ${skill.id}`);
        for (const { type, ref } of skill.evidence) {
            if (type === 'experience') assert.ok(roles.has(ref), `${skill.id} references unknown role ${ref}`);
            else if (type === 'project') assert.ok(projects.has(ref), `${skill.id} references unknown project ${ref}`);
            else {
                assert.ok(type === 'repository' || type === 'cv', `Unknown evidence type ${type}`);
                assert.equal(new URL(ref).protocol, 'https:');
            }
        }
        if (skill.techPage) assert.ok(fs.statSync(localTarget(new URL(skill.techPage, base))).isFile());
    }
    for (const variant of variants) {
        for (const id of variant.skills) assert.ok(groups.has(id), `Unknown group ${id} in ${variant.slug}`);
        for (const id of variant.projects) assert.ok(projects.has(id), `Unknown project ${id} in ${variant.slug}`);
        for (const id of variant.skillPriority ?? []) assert.ok(ids.has(id), `Unknown skill ${id} in ${variant.slug}`);
    }
}

function checkPdf(variant) {
    const file = path.join(root, 'downloads', variant.filename);
    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
    const links = execFileSync('pdfinfo', ['-url', file], { encoding: 'utf8' });
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    assert.match(info, /^Page size:\s+[^\n]+\(A4\)/m, variant.filename);
    assert.ok(variant.slug === 'full' ? pages >= 2 : pages === 2, `${variant.filename} has ${pages} pages`);
    assert.ok(text.includes(cv.name) && text.includes(variant.title), `${variant.filename} has extractable identity and title`);
    assert.ok(text.includes(cv.contact.email) && text.includes('Education') && text.includes('Languages'));
    for (const { company, start, end } of cv.experience) {
        assert.ok(text.includes(company) && text.includes(`${start} – ${end}`), `${variant.filename} contains dates and employer ${company}`);
    }
    for (const url of [cv.contact.github, cv.contact.linkedin, 'mailto:' + cv.contact.email, siteUrl]) assert.ok(links.includes(url));
}

assert.equal(variants.length, 6);
assert.equal(new Set(variants.map(({ slug }) => slug)).size, variants.length);
assert.equal(new Set(variants.map(({ filename }) => filename)).size, variants.length);
assert.equal(htmlFiles.filter((file) => path.dirname(file) === path.join(root, 'tech')).length, 20);
for (const file of htmlFiles) checkHtml(file);
for (const { id, diagram } of [...cv.projects, cv.backgroundProcessing]) {
    const svg = read(`assets/images/projects/${id}.svg`);
    assert.match(svg, /viewBox="[^"]+"[^>]+role="img"/);
    assert.match(svg, /<title[^>]+>/);
    assert.match(svg, /<desc[^>]+>/);
    assert.equal([...svg.matchAll(/class="node"/g)].length, diagram.steps.length);
}
for (const [, location] of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.ok(fs.statSync(localTarget(new URL(location))).isFile());
}
assert.ok(read('robots.txt').includes(siteUrl + 'sitemap.xml'));
checkSkills();
for (const variant of variants) checkPdf(variant);
console.log(`Validated ${htmlFiles.length} HTML pages, ${catalogue.skills.length} evidence-linked skills, 4 diagrams and ${variants.length} A4 PDFs with extractable text and hyperlinks.`);
