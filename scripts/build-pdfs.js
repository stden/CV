const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, loadCvData } = require('./lib/utils');
const { launchChromium } = require('./lib/browser');
const { LOCALES, setLocale, ui, localizeData, localeInfo, cvPdfName } = require('./lib/i18n');
const { INTER_SUBSETS, fontFile } = require('./lib/fonts');

const PDF_DIR = path.join(ROOT_DIR, 'assets', 'pdf');

function renderPdfHtml(data, variant, fontBase64, { privateCv = false, locale = 'en' } = {}) {
    setLocale(locale);
    const { profile } = data;
    const skillById = new Map(data.skills.map((s) => [s.id, s]));
    const caseById = new Map(data.caseStudies.map((c) => [c.id, c]));
    const repoByName = new Map(data.githubProjects.map((r) => [r.name, r]));

    const roles = variant.includeCompactRoles
        ? data.experience
        : data.experience.filter((r) => !r.compact);

    const isFull = variant.slug === 'full';
    const experienceFirst = privateCv || variant.slug === 'general';
    const selectedSkills = variant.skillNames ? new Set(variant.skillNames) : null;
    const fontCss = fontBase64
        ? (typeof fontBase64 === 'string'
            ? `@font-face { font-family: "Inter"; src: url("data:font/woff2;base64,${fontBase64}") format("woff2"); font-weight: 100 900; font-style: normal; }`
            : fontBase64.map(({ base64, range }) => `@font-face { font-family: "Inter"; src: url("data:font/woff2;base64,${base64}") format("woff2"); font-weight: 100 900; font-style: normal; unicode-range: ${range}; }`).join('\n'))
        : '';

    const skillsRows = variant.skillCategoryOrder
        .map((id) => skillById.get(id))
        .filter(Boolean)
        .map((cat) => ({ ...cat, items: cat.items.filter(({ name }) => !selectedSkills || selectedSkills.has(name)) }))
        .filter(({ items }) => items.length)
        .map((cat) => `<p class="skill-row"><strong>${escapeHtml(cat.title)}:</strong> ${escapeHtml(cat.items.map((i) => i.name).join(', '))}</p>`)
        .join('\n');

    const rolesHtml = roles.map((role) => {
        const compact = role.compact && experienceFirst;
        const respList = compact
            ? `<p class="summary-line">${escapeHtml(role.summary)}</p>`
            : isFull && role.compact
            ? `<p class="summary-line">${escapeHtml(role.summary)} ${escapeHtml(role.responsibilities.join(' '))}</p>`
            : `<ul class="bullets">${role.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
        const techLine = !compact && role.projectTechnologies?.length
            ? `<p class="tech-line"><strong>Technologies:</strong> ${escapeHtml(role.projectTechnologies.join(', '))}${role.additionalTechnologies?.length ? `; Additional: ${escapeHtml(role.additionalTechnologies.join(', '))}` : ''}</p>`
            : '';

        return `<article class="entry">
  <div class="entry-head">
    <h3>${escapeHtml(role.role)} — ${escapeHtml(role.company)}</h3>
    <span class="period">${escapeHtml(role.period)}</span>
  </div>
  <p class="meta">${escapeHtml(role.location)}${role.companyNote ? ` (${escapeHtml(role.companyNote)})` : ''}</p>
  ${!role.compact ? `<p class="summary-line">${escapeHtml(role.summary)}</p>` : ''}
  ${respList}
  ${techLine}
</article>`;
    }).join('\n');

    const casesHtml = variant.caseStudyIds
        .map((id) => caseById.get(id))
        .filter(Boolean)
        .map((cs) => `<article class="entry">
  <div class="entry-head">
    <h3>${escapeHtml(cs.title)}</h3>
    <span class="period">${escapeHtml(cs.scope)}</span>
  </div>
  <p class="summary-line"><strong>Problem &amp; Architecture:</strong> ${escapeHtml(cs.problem)} ${escapeHtml(cs.architecture)}</p>
  <p class="tech-line"><strong>${escapeHtml(ui('pdfKeyDecisions'))}</strong> ${escapeHtml(cs.decisions[0])} (${escapeHtml(cs.stack.join(', '))})</p>
</article>`).join('\n');

    const reposHtml = variant.githubProjectNames
        .map((name) => repoByName.get(name))
        .filter(Boolean)
        .map((r) => `<li><a href="${escapeHtml(r.url)}">${escapeHtml(r.name)}</a> (${escapeHtml(r.language)}): ${escapeHtml(r.description)} [${escapeHtml(r.ciStatus)}, updated ${escapeHtml(r.latestActivity)}]</li>`)
        .join('\n');

    const eduLine = data.education
        .map((e) => `${escapeHtml(e.degree)} — ${escapeHtml(e.institution)} (${escapeHtml(e.period)})`)
        .join('; ');
    const langLine = data.languages.map((l) => `${escapeHtml(l.name)} (${escapeHtml(l.level)})`).join(', ');
    const highlightsList = variant.focusHighlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
    const skillsSection = `<section>
  <h2>${escapeHtml(ui('pdfSkills'))}</h2>
  ${skillsRows}
</section>`;
    const experienceSection = `<section>
  <h2>${escapeHtml(ui('pdfExperience'))}</h2>
  ${rolesHtml}
</section>`;

    return `<!DOCTYPE html>
<html lang="${localeInfo(locale).htmlLang}">
<head>
<meta charset="utf-8">
${privateCv ? '<meta name="robots" content="noindex, nofollow">' : ''}
<title>${escapeHtml(profile.name)} — ${escapeHtml(variant.roleTitle)}</title>
<style>
  ${fontCss}
  @page { size: A4; margin: 10mm 12.5mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #0f172a;
    background: #ffffff;
    font-family: "Inter", Arial, Helvetica, sans-serif;
    font-size: ${isFull ? '8.7pt' : '8.85pt'};
    line-height: 1.34;
  }
  a { color: #0f5257; text-decoration: none; }
  header { border-bottom: 1.5pt solid #0f766e; padding-bottom: 5pt; margin-bottom: 6.5pt; }
  h1 { margin: 0 0 1.5pt; font-size: 16.5pt; font-weight: 800; letter-spacing: -0.02em; }
  .role-line { margin: 0 0 3pt; font-size: 10.2pt; font-weight: 700; color: #0f766e; }
  .contact-line { margin: 0; font-size: 8.4pt; color: #334155; }
  section { margin-bottom: 6.5pt; }
  h2 {
    margin: 0 0 3.5pt;
    padding-bottom: 1pt;
    border-bottom: 0.75pt solid #cbd5e1;
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0f172a;
    break-after: avoid;
  }
  p { margin: 0 0 3pt; }
  .entry { margin-bottom: 5.5pt; break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
  h3 { margin: 0; font-size: 9.2pt; font-weight: 700; color: #0f172a; }
  .period { font-size: 8.2pt; font-weight: 600; color: #334155; white-space: nowrap; }
  .meta { font-size: 8.2pt; color: #475569; margin-bottom: 2pt; }
  .summary-line { color: #1e293b; }
  .tech-line, .skill-row { font-size: 8.4pt; color: #1e293b; margin-bottom: 2pt; }
  .bullets { margin: 1.5pt 0 2.5pt; padding-left: 12pt; }
  .bullets li { margin-bottom: 1.4pt; color: #1e293b; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(profile.name)}</h1>
  <p class="role-line">${escapeHtml(variant.roleTitle)}</p>
  <p class="contact-line">
    ${escapeHtml(profile.location)} |
    <a href="mailto:${escapeHtml(profile.contact.email)}">${escapeHtml(profile.contact.email)}</a> |
    <a href="${escapeHtml(profile.contact.linkedin)}">LinkedIn</a> |
    <a href="${escapeHtml(profile.contact.github)}">GitHub</a> |
    <a href="${escapeHtml(data.site.baseUrl)}/">${escapeHtml(ui('footerPortfolio'))}</a>
  </p>
</header>

<section>
  <h2>${escapeHtml(ui('pdfSummary'))}</h2>
  <p class="summary-line">${escapeHtml(variant.summary)}</p>
  ${highlightsList ? `<ul class="bullets">${highlightsList}</ul>` : ''}
</section>

${(experienceFirst ? [experienceSection, skillsSection] : [skillsSection, experienceSection]).join('\n\n')}

${casesHtml ? `<section>
  <h2>${escapeHtml(ui('pdfEngineeringProjects'))}</h2>
  ${casesHtml}
</section>` : ''}

${reposHtml ? `<section>
  <h2>${escapeHtml(ui('pdfOpenSource'))}</h2>
  <ul class="bullets">${reposHtml}</ul>
</section>` : ''}

<section>
  <h2>${escapeHtml(ui('pdfEducationLanguages'))}</h2>
  <p><strong>${escapeHtml(ui('pdfEducation'))}:</strong> ${eduLine}</p>
  <p><strong>${escapeHtml(ui('pdfLanguages'))}:</strong> ${langLine}</p>
</section>
</body>
</html>`;
}

async function printPdf(page, html, destination) {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: destination, format: 'A4', printBackground: true, preferCSSPageSize: true });
}

async function main() {
    const data = loadCvData();
    fs.mkdirSync(PDF_DIR, { recursive: true });

    // Every subset is embedded; the browser picks the one that holds each character.
    const fonts = INTER_SUBSETS.map(({ subset, range }) => ({
        base64: fs.readFileSync(path.join(ROOT_DIR, 'assets', 'fonts', fontFile(subset))).toString('base64'),
        range,
    }));

    const browser = await launchChromium();
    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        for (const variant of data.variants) {
            const html = renderPdfHtml(data, variant, fonts);
            await printPdf(page, html, path.join(PDF_DIR, variant.pdfFilename));
            console.log(`Generated ${variant.pdfFilename}`);
        }

        // The general CV in every language, with the same content in each file.
        for (const locale of LOCALES) {
            const localized = localizeData(data, locale.code);
            const general = localized.variants.find((item) => item.slug === 'general');
            const pdfVariant = { ...general, pdfFilename: cvPdfName(locale.code) };
            const html = renderPdfHtml(localized, pdfVariant, fonts, { locale: locale.code });
            await printPdf(page, html, path.join(PDF_DIR, pdfVariant.pdfFilename));
            console.log(`Generated ${pdfVariant.pdfFilename} (${localeInfo(locale.code).name})`);
        }
        setLocale('en');

        // Rasterize og-preview.png (1200x630)
        const ogSvgPath = path.join(ROOT_DIR, 'assets', 'images', 'og-preview.svg');
        if (fs.existsSync(ogSvgPath)) {
            const ogSvg = fs.readFileSync(ogSvgPath, 'utf8');
            await page.setViewportSize({ width: 1200, height: 630 });
            await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;">${ogSvg}</body></html>`, { waitUntil: 'load' });
            await page.screenshot({ path: path.join(ROOT_DIR, 'assets', 'images', 'og-preview.png') });
            console.log('Generated assets/images/og-preview.png');
        }
    } finally {
        await browser.close();
    }
}

module.exports = { renderPdfHtml, printPdf };

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
