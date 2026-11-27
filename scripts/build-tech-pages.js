const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, loadCvData } = require('./lib/utils');
const { ui, assetPrefix, renderDocument } = require('./lib/layout');

const { localeCodes, loadLocales, localize, localizedPath } = require('./lib/i18n');

function renderHeaderIcon(data, technology) {
    if (technology.logo) {
        return `<img alt="${ui(data, 'tech.logo', { title: technology.title })}" class="tech-logo" src="${assetPrefix(data, 1)}assets/images/tech/${escapeHtml(technology.slug)}.svg" width="48" height="48">`;
    }
    return `<span class="brand-mark" aria-hidden="true">${escapeHtml(technology.title.slice(0, 2).toUpperCase())}</span>`;
}

function renderTechPage(data, technology) {
    const flowItems = technology.flow.map((step) => `      <li>${escapeHtml(step)}</li>`).join('\n');
    const capabilities = technology.capabilities.map((item) => `      <li>${escapeHtml(item)}</li>`).join('\n');
    const usedIn = technology.usedIn.map((item) => `      <li>${escapeHtml(item)}</li>`).join('\n');
    const officialLink = technology.official
        ? `\n    <p><a class="btn btn-secondary btn-sm" href="${escapeHtml(technology.official)}" target="_blank" rel="noopener noreferrer">${ui(data, 'tech.official')}</a></p>`
        : '';

    const bodyHtml = `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html#skills">&larr; ${ui(data, 'tech.back')}</a></p>
    <div class="tech-header">
      ${renderHeaderIcon(data, technology)}
      <div>
        <h1>${escapeHtml(technology.title)}</h1>
      </div>
    </div>
    <p class="section-lead">${escapeHtml(technology.summary)}</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2>${ui(data, 'tech.flow')}</h2>
    <ol class="flow-steps">
${flowItems}
    </ol>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2>${ui(data, 'tech.capabilities')}</h2>
    <ul class="bullet-list">
${capabilities}
    </ul>
    <h2>${ui(data, 'tech.usedIn')}</h2>
    <ul class="bullet-list">
${usedIn}
    </ul>${officialLink}
  </div>
</section>`;

    return renderDocument(data, {
        depth: 1,
        title: `${technology.title} — ${data.profile.name} | ${data.t('ui.tech.notes')}`,
        description: technology.summary,
        canonicalPath: `tech/${technology.slug}.html`,
        bodyHtml,
    });
}

function main() {
    const data = loadCvData();
    const dictionaries = loadLocales(data);
    for (const code of localeCodes) {
        const cv = localize(data, code, dictionaries[code]);
        const directory = path.join(ROOT_DIR, localizedPath(code, 'tech'));
        fs.mkdirSync(directory, { recursive: true });
        for (const technology of cv.technologies) {
            fs.writeFileSync(path.join(directory, `${technology.slug}.html`), renderTechPage(cv, technology));
        }
    }
    console.log(`Generated ${data.technologies.length} technology pages in each language.`);
}

if (require.main === module) {
    main();
}
