const fs = require('node:fs');
const path = require('node:path');
const articles = require('../data/articles.json');

const INDEX_ROUTE = 'articles/';
const indexTitle = 'Engineering articles';
const indexSummary = 'Short notes on Java concurrency and distributed processing, with public sources and reproducible examples.';
const articleRoute = ({ slug }) => `${INDEX_ROUTE}${slug}/`;
const articleRoutes = Object.freeze([INDEX_ROUTE, ...articles.map(articleRoute)]);
const dateFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

function renderDate(date, escape) {
    return `<time datetime="${escape(date)}">${dateFormat.format(new Date(`${date}T00:00:00Z`))}</time>`;
}

function breadcrumbGraph(base, links) {
    return {
        '@type': 'BreadcrumbList',
        itemListElement: links.map(([name, route], index) => ({
            '@type': 'ListItem', position: index + 1, name, item: base + route,
        })),
    };
}

function renderIndex(data, renderDocument, escape) {
    const base = `${data.site.baseUrl}/`;
    const entries = articles.map((article) => `<article class="card">
        <p class="section-eyebrow">${escape(article.topic)}</p>
        <h2 class="card-title"><a href="${escape(article.slug)}/">${escape(article.title)}</a></h2>
        <p class="card-body">${escape(article.summary)}</p>
        <p class="role-period">${renderDate(article.published, escape)}</p>
      </article>`).join('\n');

    return renderDocument(data, {
        depth: 1,
        canonicalPath: INDEX_ROUTE,
        title: `${indexTitle} — ${data.profile.name}`,
        description: indexSummary,
        bodyHtml: `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../">Portfolio</a> / ${indexTitle}</p>
    <h1>${indexTitle}</h1>
    <p class="section-lead">${indexSummary}</p>
  </div>
</section>
<div class="section">
  <div class="container">
    <div class="repo-grid">
      ${entries}
    </div>
  </div>
</div>`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [{
                '@type': 'CollectionPage',
                '@id': `${base}${INDEX_ROUTE}#page`,
                url: base + INDEX_ROUTE,
                name: indexTitle,
                description: indexSummary,
                inLanguage: 'en',
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: articles.map((article, index) => ({
                        '@type': 'ListItem',
                        position: index + 1,
                        url: base + articleRoute(article),
                        name: article.title,
                    })),
                },
            }, breadcrumbGraph(base, [['Portfolio', ''], [indexTitle, INDEX_ROUTE]])],
        },
    });
}

function renderArticleSection(section, index, escape) {
    const paragraphs = section.paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('\n');
    const examples = (section.examples ?? []).map(({ label, language, code }) => `
      <figure>
        <figcaption>${escape(label)}</figcaption>
        <pre style="white-space:pre-wrap;overflow-wrap:anywhere"><code class="language-${escape(language)}">${escape(code)}</code></pre>
      </figure>`).join('\n');
    const sources = (section.sources ?? []).map(({ label, url }) =>
        `<li><a href="${escape(url)}">${escape(label)}</a></li>`).join('\n');
    return `<section aria-labelledby="note-section-${index + 1}">
      <h2 id="note-section-${index + 1}">${escape(section.heading)}</h2>
      ${paragraphs}
      ${examples}
      ${sources ? `<ul class="bullet-list">${sources}</ul>` : ''}
    </section>`;
}

function renderArticle(data, article, renderDocument, escape) {
    const base = `${data.site.baseUrl}/`;
    const route = articleRoute(article);
    const url = base + route;
    const sections = article.sections.map((section, index) => renderArticleSection(section, index, escape)).join('\n');
    const citations = [...new Set(article.sections.flatMap(({ sources = [] }) => sources.map(({ url: source }) => source)))];
    const stamp = `Published ${renderDate(article.published, escape)} · Revised ${renderDate(article.revised, escape)}`;

    return renderDocument(data, {
        depth: 2,
        canonicalPath: route,
        title: `${article.title} — ${data.profile.name}`,
        description: article.summary,
        ogType: 'article',
        bodyHtml: `<article aria-labelledby="article-title">
  <header class="subpage-hero">
    <div class="container">
      <p class="breadcrumb"><a href="../">${indexTitle}</a> / ${escape(article.topic)}</p>
      <h1 id="article-title">${escape(article.title)}</h1>
      <p class="section-lead">${escape(article.summary)}</p>
      <p>By <a href="../../">${escape(data.profile.name)}</a> · ${stamp}</p>
    </div>
  </header>
  <div class="section">
    <div class="container">
      <div style="max-width:75ch">
        ${sections}
        <p><a href="../../${escape(article.related.route)}">${escape(article.related.label)}</a></p>
      </div>
    </div>
  </div>
</article>`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [{
                '@type': 'Article',
                '@id': `${url}#article`,
                url,
                headline: article.title,
                description: article.summary,
                inLanguage: 'en',
                datePublished: article.published,
                dateModified: article.revised,
                author: {
                    '@type': 'Person',
                    '@id': `${base}#person`,
                    name: data.profile.name,
                    url: base,
                },
                mainEntityOfPage: url,
                citation: citations,
            }, breadcrumbGraph(base, [['Portfolio', ''], [indexTitle, INDEX_ROUTE], [article.title, route]])],
        },
    });
}

function buildArticles(data, outputRoot = path.resolve(__dirname, '..')) {
    const { renderDocument } = require('./lib/layout');
    const { escapeHtml } = require('./lib/utils');
    if (data.locale !== 'en') throw new Error('Engineering articles require English portfolio data');
    const pages = [
        [INDEX_ROUTE, renderIndex(data, renderDocument, escapeHtml)],
        ...articles.map((article) => [articleRoute(article), renderArticle(data, article, renderDocument, escapeHtml)]),
    ];
    for (const [route, html] of pages) {
        const directory = path.join(outputRoot, route);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'index.html'), html);
    }
    return articleRoutes;
}

module.exports = { articleRoutes, buildArticles };

if (require.main === module) {
    const { loadCvData } = require('./lib/utils');
    const { localize, loadLocales } = require('./lib/i18n');
    const data = loadCvData();
    buildArticles(localize(data, 'en', loadLocales(data).en));
}
