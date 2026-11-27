const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, loadCvData } = require('./lib/utils');
const { launchChromium } = require('./lib/browser');
const { localeCodes, loadLocales, localize, localizedPdfName, localizedPath, localizedSkillName } = require('./lib/i18n');
const { FONT_SUBSETS } = require('./lib/fonts');

const PDF_DIR = path.join(ROOT_DIR, 'assets', 'pdf');

function embeddedFont(data, range) {
    const unicodeRange = range ? ` unicode-range: ${range};` : '';
    return `@font-face { font-family: "Inter"; src: url("data:font/woff2;base64,${data}") format("woff2"); font-weight: 100 900; font-style: normal;${unicodeRange} }`;
}

function pdfFontCss(fonts) {
    if (Array.isArray(fonts)) return fonts.map(({ data, range }) => embeddedFont(data, range)).join('\n  ');
    return fonts ? embeddedFont(fonts) : '';
}

function renderPdfHtml(data, variant, fonts, { privateCv = false } = {}) {
    const { profile } = data;
    const locale = data.locale ?? 'en';
    const label = (key, fallback) => escapeHtml(typeof data.t === 'function' ? data.t(`ui.${key}`) : fallback);
    const skillById = new Map(data.skills.map((s) => [s.id, s]));
    const caseById = new Map(data.caseStudies.map((c) => [c.id, c]));
    const repoByName = new Map(data.githubProjects.map((r) => [r.name, r]));

    const roles = variant.includeCompactRoles
        ? data.experience
        : data.experience.filter((r) => !r.compact);

    const isFull = variant.slug === 'full';
    const experienceFirst = privateCv || variant.slug === 'general';
    const selectedSkills = variant.skillNames ? new Set(variant.skillNames) : null;
    const fontCss = pdfFontCss(fonts);

    const selectedCategories = variant.skillCategoryOrder
        .map((id) => skillById.get(id))
        .filter(Boolean)
        .map((cat) => ({ ...cat, items: cat.items.filter(({ name }) => !selectedSkills || selectedSkills.has(name)) }));
    const familiarity = selectedCategories.flatMap(({ items }) => items.filter(({ tier }) => tier === 'familiarity'));
    const skillRows = selectedCategories
        .map(({ title, items }) => ({ title, items: items.filter(({ tier }) => tier !== 'familiarity') }))
        .filter(({ items }) => items.length);
    if (familiarity.length) skillRows.push({
        title: typeof data.t === 'function' ? data.t('ui.skills.familiarity') : 'Familiarity', items: familiarity,
    });
    const skillsRows = skillRows.map(({ title, items }) =>
        `<p class="skill-row"><strong>${escapeHtml(title)}:</strong> ${escapeHtml(items.map(({ name }) => localizedSkillName(data, name)).join(', '))}</p>`).join('\n');

    const rolesHtml = roles.map((role) => {
        const compact = role.compact && experienceFirst;
        const respList = compact
            ? `<p class="summary-line">${escapeHtml(role.summary)}</p>`
            : isFull && role.compact
            ? `<p class="summary-line">${escapeHtml(role.summary)} ${escapeHtml(role.responsibilities.join(' '))}</p>`
            : `<ul class="bullets">${role.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
        const techLine = !compact && role.projectTechnologies?.length
            ? `<p class="tech-line"><strong>${label('pdf.technologies', 'Technologies')}:</strong> ${escapeHtml(role.projectTechnologies.join(', '))}${role.additionalTechnologies?.length ? `; ${label('pdf.additional', 'Additional')}: ${escapeHtml(role.additionalTechnologies.join(', '))}` : ''}</p>`
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
  <p class="summary-line"><strong>${label('pdf.problemArchitecture', 'Problem & Architecture')}:</strong> ${escapeHtml(cs.problem)} ${escapeHtml(cs.architecture)}</p>
  <p class="tech-line"><strong>${label('pdf.decisionsStack', 'Key Decisions & Stack')}:</strong> ${escapeHtml(cs.decisions[0])} (${escapeHtml(cs.stack.join(', '))})</p>
</article>`).join('\n');

    const reposHtml = variant.githubProjectNames
        .map((name) => repoByName.get(name))
        .filter(Boolean)
        .map((r) => `<li><a href="${escapeHtml(r.url)}">${escapeHtml(r.name)}</a> (${escapeHtml(r.language)}): ${escapeHtml(r.description)} [${escapeHtml(r.ciStatus)}, ${label('pdf.updated', 'updated')} ${escapeHtml(r.latestActivity)}]</li>`)
        .join('\n');

    const eduLine = data.education
        .map((e) => `${escapeHtml(e.degree)} — ${escapeHtml(e.institution)} (${escapeHtml(e.period)})`)
        .join('; ');
    const langLine = data.languages.map((l) => `${escapeHtml(l.name)} (${escapeHtml(l.level)})`).join(', ');
    const highlightsList = variant.focusHighlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
    const skillsSection = `<section>
  <h2>${label('pdf.skills', 'Technical Skills')}</h2>
  ${skillsRows}
</section>`;
    const experienceSection = `<section>
  <h2>${label('experience.section', 'Professional Experience')}</h2>
  ${rolesHtml}
</section>`;

    return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
${privateCv ? '<meta name="viewport" content="width=device-width, initial-scale=1">' : ''}
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
    font-size: ${isFull ? '8.7pt' : '9.45pt'};
    line-height: ${isFull ? '1.34' : '1.38'};
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
    font-size: ${isFull ? '9.5pt' : '10pt'};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0f172a;
    break-after: avoid;
  }
  p { margin: 0 0 3pt; }
  .entry { margin-bottom: 5.5pt; break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
  h3 { margin: 0; font-size: ${isFull ? '9.2pt' : '9.6pt'}; font-weight: 700; color: #0f172a; }
  .period { font-size: 8.2pt; font-weight: 600; color: #334155; white-space: nowrap; }
  .meta { font-size: 8.2pt; color: #475569; margin-bottom: 2pt; }
  .summary-line { color: #1e293b; }
  .tech-line, .skill-row { font-size: 8.4pt; color: #1e293b; margin-bottom: 2pt; }
  .bullets { margin: 1.5pt 0 2.5pt; padding-left: 12pt; }
  .bullets li { margin-bottom: 1.4pt; color: #1e293b; }
  ${privateCv ? '@media screen { body { max-width: 52rem; margin-inline: auto; padding: 1.2rem; font-size: .93rem; } .entry-head { flex-wrap: wrap; gap: .1rem .5rem; } }' : ''}
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
    <a href="${escapeHtml(`${data.site.baseUrl}/${localizedPath(locale)}`)}">${label('common.portfolio', 'Portfolio')}</a>
  </p>
</header>

<section>
  <h2>${label('pdf.summary', 'Summary')}</h2>
  <p class="summary-line">${escapeHtml(variant.summary)}</p>
  ${highlightsList ? `<ul class="bullets">${highlightsList}</ul>` : ''}
</section>

${(experienceFirst ? [experienceSection, skillsSection] : [skillsSection, experienceSection]).join('\n\n')}

${casesHtml ? `<section>
  <h2>${label('pdf.projects', 'Selected Engineering Projects')}</h2>
  ${casesHtml}
</section>` : ''}

${reposHtml ? `<section>
  <h2>${label('pdf.openSource', 'Open-Source Highlights')}</h2>
  <ul class="bullets">${reposHtml}</ul>
</section>` : ''}

<section>
  <h2>${label('pdf.educationLanguages', 'Education & Languages')}</h2>
  <p><strong>${label('common.education', 'Education')}:</strong> ${eduLine}</p>
  <p><strong>${label('common.languages', 'Languages')}:</strong> ${langLine}</p>
</section>
</body>
</html>`;
}

async function printPdf(page, html, destination) {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
        path: destination, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true,
    });
}

async function main() {
    const data = loadCvData();
    const dictionaries = loadLocales(data);
    fs.mkdirSync(PDF_DIR, { recursive: true });

    const fontPath = path.join(ROOT_DIR, 'assets', 'fonts', 'inter-latin-wght-normal.woff2');
    const fontBase64 = fs.existsSync(fontPath) ? fs.readFileSync(fontPath).toString('base64') : '';
    const localizedFonts = FONT_SUBSETS.map(({ filename, range }) => {
        const asset = path.join(ROOT_DIR, 'assets', 'fonts', filename);
        const source = fs.existsSync(asset) ? asset
            : path.join(ROOT_DIR, 'node_modules', '@fontsource-variable', 'inter', 'files', filename);
        return { data: fs.readFileSync(source, 'base64'), range };
    });

    const browser = await launchChromium();
    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        for (const variant of data.variants) {
            const html = renderPdfHtml(data, variant, fontBase64);
            await printPdf(page, html, path.join(PDF_DIR, variant.pdfFilename));
            console.log(`Generated ${variant.pdfFilename}`);
        }

        const general = data.variants.find(({ slug }) => slug === 'general');
        fs.copyFileSync(path.join(PDF_DIR, general.pdfFilename), path.join(PDF_DIR, localizedPdfName('en')));
        console.log(`Generated ${localizedPdfName('en')}`);
        for (const code of localeCodes.filter((locale) => locale !== 'en')) {
            const localized = localize(data, code, dictionaries[code]);
            const variant = localized.variants.find(({ slug }) => slug === general.slug);
            const filename = localizedPdfName(code);
            await printPdf(page, renderPdfHtml(localized, variant, localizedFonts), path.join(PDF_DIR, filename));
            console.log(`Generated ${filename}`);
        }

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
