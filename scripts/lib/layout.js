const { escapeHtml, relPrefix } = require('./utils');
const { LOCALES, localeCodes, localizedPath, localizedPdfName } = require('./i18n');
const { availableLanguages } = require('./public-artifact');
const { PROFILE_FORMATS } = require('./public-profile');

const NAV_ITEMS = [
    { id: 'overview', key: 'overview' },
    { id: 'experience', page: 'experience/', key: 'experience' },
    { id: 'skills', page: 'skills/', key: 'skills' },
    { id: 'projects', page: 'projects/', key: 'projects' },
    { page: 'architecture/', key: 'architecture' },
    { page: 'cv/', key: 'cv' },
    { id: 'contact', page: 'contact/', key: 'contact' },
];

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cv-theme');if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches){t='dark';}if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(_){}})();`;

function ui(data, key, vars) {
    return escapeHtml(data.t(`ui.${key}`, vars));
}

function displayCiStatus(data, status) {
    const key = { Passing: 'ciSuccess', Failing: 'ciFailure', Cancelled: 'ciCancelled' }[status] || 'unverified';
    return ui(data, `projects.${key}`);
}

function assetPrefix(data, depth = 0) {
    return relPrefix(depth + (data.locale === 'en' ? 0 : 1));
}

function pageUrl(data, contentPath = '', code = data.locale) {
    return `${data.site.baseUrl}/${localizedPath(code, contentPath)}`;
}

function defaultCvHref(data, depth = 0) {
    return `${assetPrefix(data, depth)}assets/pdf/${localizedPdfName(data.locale)}`;
}

function renderLanguageMenu(data, depth, contentPath) {
    const equivalents = availableLanguages(contentPath);
    const links = localeCodes.map((code) => {
        const { label, nativeName } = LOCALES[code];
        const fallback = contentPath.startsWith('cv/') ? 'cv/index.html' : '';
        const target = equivalents.includes(code) ? contentPath : fallback;
        const href = assetPrefix(data, depth) + (localizedPath(code, target) || './');
        const current = code === data.locale ? ' aria-current="page"' : '';
        return `<a href="${href}" hreflang="${code}" lang="${code}" aria-label="${label} · ${nativeName}" data-locale="${code}"${current}>${label}</a>`;
    }).join('');
    return `<nav class="language-menu" aria-label="${ui(data, 'nav.languages')}">${links}</nav>`;
}

function renderHeader(data, { depth, canonicalPath, downloadHref }) {
    const prefix = relPrefix(depth);
    const homeHref = `${prefix}index.html`;
    const pdfHref = downloadHref || defaultCvHref(data, depth);

    const navLinks = NAV_ITEMS.map((item) => {
        const href = item.page && (depth || !item.id)
            ? `${prefix}${item.page}`
            : `${homeHref}#${item.id}`;
        return `        <li><a href="${href}">${ui(data, `nav.${item.key}`)}</a></li>`;
    }).join('\n');

    return `<a class="skip-link" href="#main-content">${ui(data, 'nav.skip')}</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${homeHref}">
      <span class="brand-mark" aria-hidden="true">DS</span>
      <span>${escapeHtml(data.profile.name)}</span>
    </a>
    <nav class="primary-nav" aria-label="${ui(data, 'nav.primary')}">
      <ul class="nav-links">
${navLinks}
      </ul>
    </nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="theme-toggle" aria-pressed="false" aria-label="${ui(data, 'theme.dark')} · ${ui(data, 'theme.toDark')}"
        data-light-label="${ui(data, 'theme.light')}" data-dark-label="${ui(data, 'theme.dark')}"
        data-to-light="${ui(data, 'theme.light')} · ${ui(data, 'theme.toLight')}"
        data-to-dark="${ui(data, 'theme.dark')} · ${ui(data, 'theme.toDark')}">
        <span class="theme-label">${ui(data, 'theme.dark')}</span>
      </button>
      ${depth ? `<a class="btn btn-primary btn-sm header-cv-btn" href="${escapeHtml(pdfHref)}" download>${ui(data, 'action.download')}</a>` : ''}
      <button type="button" class="icon-btn nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="mobile-drawer" aria-label="${ui(data, 'nav.menu')} · ${ui(data, 'nav.menuToggle')}">
        ${ui(data, 'nav.menu')}
      </button>
    </div>
    ${renderLanguageMenu(data, depth, canonicalPath)}
  </div>
  <div id="mobile-drawer" class="mobile-drawer" hidden>
    <ul>
${navLinks}
      ${depth ? `<li><a href="${escapeHtml(pdfHref)}" download>${ui(data, 'action.downloadPdf')}</a></li>` : ''}
    </ul>
  </div>
</header>`;
}

function renderFooter(data, { depth = 0 } = {}) {
    const prefix = relPrefix(depth);
    const publicPrefix = assetPrefix(data, depth);
    return `<footer class="site-footer">
  <div class="container footer-inner">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(data.profile.name)} &middot; ${escapeHtml(data.profile.location)}</p>
    <div class="footer-links">
      <a href="${prefix}index.html">${ui(data, 'common.portfolio')}</a>
      <a href="${prefix}cv/">${ui(data, 'common.allCv')}</a>
      <a href="${publicPrefix}contact/#public-cv-formats" hreflang="en">${ui(data, 'discovery.formats')}</a>
      <a href="${publicPrefix}role-alignment/" hreflang="en">${ui(data, 'discovery.roles')}</a>
      <a href="${publicPrefix}articles/" hreflang="en">${ui(data, 'discovery.articles')}</a>
      <a href="${escapeHtml(data.profile.contact.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="${escapeHtml(data.profile.contact.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href="mailto:${escapeHtml(data.profile.contact.email)}">${ui(data, 'common.email')}</a>
    </div>
  </div>
</footer>`;
}

function renderDocument(data, options) {
    const {
        depth = 0,
        title,
        description,
        canonicalPath = '',
        ogType = 'website',
        jsonLd = null,
        downloadHref = null,
        bodyHtml,
    } = options;

    const prefix = assetPrefix(data, depth);
    const canonicalUrl = pageUrl(data, canonicalPath);
    const translations = availableLanguages(canonicalPath);
    const alternates = translations.map((code) =>
        `  <link rel="alternate" hreflang="${code}" href="${pageUrl(data, canonicalPath, code)}">`).join('\n');
    const ogLocales = translations.filter((code) => code !== data.locale).map((code) =>
        `  <meta property="og:locale:alternate" content="${LOCALES[code].og}">`).join('\n');
    const publicFormats = canonicalPath === '' || canonicalPath === 'cv/general.html'
        ? ['resume.md', 'resume.txt', 'candidate.json', 'skills-evidence.json', 'role-alignment.json']
        : canonicalPath === 'role-alignment/' ? ['role-alignment.json'] : [];
    const profileLinks = publicFormats.map((name) => {
        const relation = name.startsWith('resume.') ? 'alternate' : 'describedby';
        return `  <link rel="${relation}" type="${PROFILE_FORMATS[name]}" href="${pageUrl(data, name, 'en')}">`;
    }).join('\n');
    const ogImageUrl = `${data.site.baseUrl}/assets/images/og-preview.png`;

    const jsonLdBlock = jsonLd
        ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
        : '';

    return `<!DOCTYPE html>
<html lang="${data.locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(data.profile.name)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${pageUrl(data, canonicalPath, 'en')}">
${profileLinks}
  <meta property="og:locale" content="${LOCALES[data.locale].og}">
${ogLocales}
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  <link rel="icon" href="${prefix}favicon.ico">
  <link rel="preload" href="${prefix}assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${prefix}assets/css/style.css">
  <script>${THEME_INIT_SCRIPT}</script>${jsonLdBlock}
</head>
<body>
${renderHeader(data, { depth, canonicalPath, downloadHref })}
<main id="main-content">
${bodyHtml}
</main>
${renderFooter(data, { depth })}
<script src="${prefix}assets/js/main.js" defer></script>
</body>
</html>
`.replace(/[ \t]+$/gm, '');
}

module.exports = {
    ui, assetPrefix, pageUrl, defaultCvHref, displayCiStatus,
    renderDocument,
};
