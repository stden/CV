const fs = require('node:fs');
const path = require('node:path');

function checkedName(value, pattern) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error('PUBLIC_MANIFEST_INVALID');
    return value;
}

const DETAIL_PAGES = ['experience', 'skills', 'projects', 'architecture'];

function publicFiles(data) {
    const slug = (value) => checkedName(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const photo = checkedName(data.profile.photo, /^assets\/images\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/);
    return [...new Set([
        '.nojekyll', 'index.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'cv/index.html',
        ...DETAIL_PAGES.map((route) => `${route}/index.html`),
        'assets/css/style.css', 'assets/js/main.js', 'assets/fonts/inter-latin-wght-normal.woff2',
        'assets/fonts/INTER-LICENSE.txt', 'assets/images/og-preview.png', 'assets/images/og-preview.svg', photo,
        ...data.variants.flatMap((item) => [
            `cv/${slug(item.slug)}.html`,
            `assets/pdf/${checkedName(item.pdfFilename, /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.pdf$/)}`,
        ]),
        ...data.technologies.flatMap((item) => [
            `tech/${slug(item.slug)}.html`,
            ...(item.logo ? [`assets/images/tech/${slug(item.slug)}.svg`] : []),
        ]),
        ...(data.githubProjects ?? []).filter((item) => item.previewImage).map(({ previewImage }) =>
            checkedName(previewImage, /^assets\/images\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*-preview\.webp$/)),
        ...data.architectureDiagrams.map((item) => `assets/images/projects/${slug(item.slug)}.svg`),
    ])].sort();
}

function references(file, content) {
    if (/\.(?:html|svg)$/i.test(file)) {
        return [
            ...[...content.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(([, ref]) => ref),
            ...[...content.matchAll(/<meta\b[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)].map(([, ref]) => ref),
        ];
    }
    if (file.endsWith('.css')) return [...content.matchAll(/\burl\(\s*["']?([^\s"')]+)["']?\s*\)/gi)].map(([, ref]) => ref);
    if (file.endsWith('.xml')) return [...content.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(([, ref]) => ref);
    if (file === 'robots.txt') return [...content.matchAll(/^Sitemap:\s*(\S+)/gim)].map(([, ref]) => ref);
    return [];
}

function validatePublicLinks(root, baseUrl, files) {
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    const allowed = new Set(files);
    const documentIds = new Map();
    for (const file of files.filter((value) => /(?:\.(?:html|svg|css|xml)|^robots\.txt)$/i.test(value))) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const pageUrl = new URL(file, base);
        for (const reference of references(file, source)) {
            let url;
            try {
                url = new URL(reference.replace(/&amp;/g, '&'), pageUrl);
            } catch {
                throw new Error('PUBLIC_LINK_INVALID');
            }
            if (url.origin !== base.origin) continue;
            if (!url.pathname.startsWith(base.pathname)) throw new Error('PUBLIC_LINK_OUTSIDE_BASE');
            let dest;
            try {
                dest = decodeURIComponent(url.pathname.slice(base.pathname.length));
            } catch {
                throw new Error('PUBLIC_LINK_INVALID');
            }
            if (!allowed.has(dest)) dest = dest ? `${dest.replace(/\/$/, '')}/index.html` : 'index.html';
            if (!allowed.has(dest)) throw new Error('PUBLIC_LINK_TARGET_MISSING');
            if (url.hash && dest.endsWith('.html')) {
                if (!documentIds.has(dest)) {
                    const html = fs.readFileSync(path.join(root, dest), 'utf8');
                    documentIds.set(dest, new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(([, id]) => id)));
                }
                let id;
                try {
                    id = decodeURIComponent(url.hash.slice(1));
                } catch {
                    throw new Error('PUBLIC_LINK_INVALID');
                }
                if (!documentIds.get(dest).has(id)) throw new Error('PUBLIC_LINK_TARGET_MISSING');
            }
        }
    }
}

module.exports = { DETAIL_PAGES, publicFiles, validatePublicLinks };
