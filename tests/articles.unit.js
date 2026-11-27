const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const cv = require('../data/cv.json');
const english = require('../data/locales/en.json');
const articles = require('../data/articles.json');
const { localize } = require('../scripts/lib/i18n');
const { articleRoutes, buildArticles } = require('../scripts/build-articles');

test('article index and detail routes publish dated, attributed notes with public citations', (t) => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-articles-test-'));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));

    const data = localize(cv, 'en', english);
    assert.deepEqual(buildArticles(data, output), articleRoutes);
    assert.equal(articleRoutes.length, articles.length + 1);
    const index = fs.readFileSync(path.join(output, articleRoutes[0], 'index.html'), 'utf8');
    assert.match(index, /<h1>Engineering articles<\/h1>/);
    for (const [offset, article] of articles.entries()) {
        const route = articleRoutes[offset + 1];
        assert.equal(route, `articles/${article.slug}/`);
        assert.ok(index.includes(`href="${article.slug}/"`));

        const html = fs.readFileSync(path.join(output, route, 'index.html'), 'utf8');
        const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])['@graph'];
        const metadata = graph.find((item) => item['@type'] === 'Article');
        assert.equal(metadata.headline, article.title);
        assert.equal(metadata.author.name, cv.profile.name);
        assert.equal(metadata.datePublished, article.published);
        assert.equal(metadata.dateModified, article.revised);
        assert.equal(metadata.url, `${cv.site.baseUrl}/${route}`);
        assert.match(html, /<figure>\s*<figcaption>[^<]+<\/figcaption>/);
        assert.ok(html.includes(`datetime="${article.published}"`));
        for (const source of metadata.citation) {
            const url = new URL(source);
            assert.equal(url.protocol, 'https:');
            assert.ok(['github.com', 'www.postgresql.org'].includes(url.hostname));
            assert.ok(html.includes(`href="${source}"`));
        }
    }
});
