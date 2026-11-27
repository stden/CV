const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, loadCvData } = require('./lib/utils');
const { renderDocument } = require('./lib/layout');

const OUTPUT_DIR = path.join(ROOT_DIR, 'tech');

function renderHeaderIcon(technology) {
    if (technology.logo) {
        return `<img alt="${escapeHtml(technology.title)} logo" class="tech-logo" src="../assets/images/tech/${escapeHtml(technology.slug)}.svg" width="48" height="48">`;
    }
    return `<span class="brand-mark" aria-hidden="true">${escapeHtml(technology.title.slice(0, 2).toUpperCase())}</span>`;
}

function renderTechPage(data, technology) {
    const flowItems = technology.flow.map((step) => `      <li>${escapeHtml(step)}</li>`).join('\n');
    const capabilities = technology.capabilities.map((item) => `      <li>${escapeHtml(item)}</li>`).join('\n');
    const usedIn = technology.usedIn.map((item) => `      <li>${escapeHtml(item)}</li>`).join('\n');
    const officialLink = technology.official
        ? `\n    <p><a class="btn btn-secondary btn-sm" href="${escapeHtml(technology.official)}" target="_blank" rel="noopener noreferrer">Official documentation</a></p>`
        : '';

    const bodyHtml = `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html#skills">&larr; Back to Portfolio &amp; Skills</a></p>
    <div class="tech-header">
      ${renderHeaderIcon(technology)}
      <div>
        <h1>${escapeHtml(technology.title)}</h1>
      </div>
    </div>
    <p class="section-lead">${escapeHtml(technology.summary)}</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2>Execution &amp; architecture flow</h2>
    <ol class="flow-steps">
${flowItems}
    </ol>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2>Engineering capabilities</h2>
    <ul class="bullet-list">
${capabilities}
    </ul>
    <h2>Where used</h2>
    <ul class="bullet-list">
${usedIn}
    </ul>${officialLink}
  </div>
</section>`;

    return renderDocument(data, {
        depth: 1,
        title: `${technology.title} — ${data.profile.name} | Technology Notes`,
        description: technology.summary,
        canonicalPath: `tech/${technology.slug}.html`,
        bodyHtml,
    });
}

function main() {
    const data = loadCvData();
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const technology of data.technologies) {
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${technology.slug}.html`),
            renderTechPage(data, technology)
        );
    }
    console.log(`Generated ${data.technologies.length} technology pages in ${OUTPUT_DIR}`);
}

if (require.main === module) {
    main();
}
