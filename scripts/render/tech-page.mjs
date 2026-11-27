import { documentShell, escapeHtml } from '../lib/html.mjs';

function list(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n      ');
}

// Technology pages keep their original content. Only the layout changed.
export function renderTechPage(content, technology, logoExists) {
  const { cv, site } = content;
  const pagePath = `tech/${technology.slug}.html`;
  const logo = logoExists ? `<img class="tech-logo" alt="" width="48" height="48" src="../assets/images/tech/${technology.slug}.svg">` : '';
  const official = technology.official
    ? `<p><a class="text-link" href="${technology.official}" rel="noopener">Official site</a></p>`
    : '';
  const body = `<article class="tech-page">
  <div class="container tech-page__inner">
    <p><a class="text-link" href="../#skills">← Back to skills</a></p>
    <header class="tech-header">${logo}<h1>${escapeHtml(technology.title)}</h1></header>
    <p class="lead">${escapeHtml(technology.summary)}</p>
    <section aria-labelledby="flow-title">
      <h2 id="flow-title">How it works</h2>
      <ol class="flow">
      ${list(technology.flow)}
      </ol>
    </section>
    <section aria-labelledby="capabilities-title">
      <h2 id="capabilities-title">Capabilities</h2>
      <ul>
      ${list(technology.capabilities)}
      </ul>
    </section>
    <section aria-labelledby="used-title">
      <h2 id="used-title">Where I used it</h2>
      <ul>
      ${list(technology.usedIn)}
      </ul>
    </section>
    ${official}
  </div>
</article>`;
  return documentShell({
    title: `${technology.title} — skills | ${cv.name}`,
    description: technology.summary,
    pagePath,
    prefix: '../',
    site,
    body,
    jsonLd: [],
    bodyClass: 'page-tech',
    ogType: 'article'
  });
}
