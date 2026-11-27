const path = require('node:path');
const { escapeHtml, relPrefix } = require('./utils');
const { LOCALES, localeInfo, ui, currentLocaleCode, switchTarget, isTranslatedPage, pageOutputPath, cvPdfName, TRANSLATED_PAGE_KEYS } = require('./i18n');

// Compact navigation: four secondary pages, the CV versions, and the contact section on the homepage.
const NAV_ITEMS = [
    { id: 'experience', labelKey: 'navExperience', page: 'experience/index.html', translated: true },
    { id: 'projects', labelKey: 'navProjects', page: 'projects/index.html', translated: true },
    { id: 'skills', labelKey: 'navSkills', page: 'skills/index.html', translated: true },
    { id: 'architecture', labelKey: 'navArchitecture', page: 'architecture/index.html', translated: false },
    { id: 'cv', labelKey: 'navCvs', page: 'cv/index.html', translated: true },
    { id: 'contact', labelKey: 'navContact', translated: true },
];

// localePrefix leads to the locale's own pages; rootPrefix leads to the English-only pages.
function navHref(item, localePrefix, rootPrefix) {
    if (!item.page) return `${localePrefix}index.html#${item.id}`;
    return `${item.translated ? localePrefix : rootPrefix}${item.page}`;
}

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cv-theme');if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches){t='dark';}if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(_){}})();`;

// The Download CV button of a page: the PDF of the locale being built.
function defaultCvHref(data, depth = 0) {
    return `${relPrefix(depth)}assets/pdf/${cvPdfName(currentLocaleCode())}`;
}

const OG_LOCALE = { en: 'en_GB', et: 'et_EE', de: 'de_DE', ru: 'ru_RU' };

// The language switch: one link per locale, the current one marked and announced.
function renderLanguageSwitcher(pageKey, outputPath) {
    const current = currentLocaleCode();
    const items = LOCALES.map((locale) => {
        const target = switchTarget(locale.code, pageKey);
        const href = path.posix.relative(path.posix.dirname(outputPath), target) || 'index.html';
        const isCurrent = locale.code === current;
        const attrs = isCurrent ? ' aria-current="true" class="lang-link is-current"' : ' class="lang-link"';
        return `<li><a href="${escapeHtml(href)}" lang="${locale.htmlLang}" hreflang="${locale.htmlLang}"${attrs} title="${escapeHtml(locale.name)}"><span aria-hidden="true">${locale.label}</span><span class="visually-hidden">${escapeHtml(locale.name)}</span></a></li>`;
    }).join('');
    return `<nav class="lang-switcher" aria-label="${escapeHtml(ui('languageLabel'))}"><ul>${items}</ul></nav>`;
}

function renderHeader(data, { depth = 0, localeDepth = 0, downloadHref = null, outputPath, pageKey }) {
    const prefix = relPrefix(depth);
    const localePrefix = relPrefix(depth - localeDepth);
    const homeHref = `${localePrefix}index.html`;
    const pdfHref = downloadHref || defaultCvHref(data, depth);

    const navLinks = NAV_ITEMS.map(
        (item) => `        <li><a href="${navHref(item, localePrefix, prefix)}">${escapeHtml(ui(item.labelKey))}</a></li>`
    ).join('\n');

    const mobileLinks = NAV_ITEMS.map(
        (item) => `      <li><a href="${navHref(item, localePrefix, prefix)}">${escapeHtml(ui(item.labelKey))}</a></li>`
    ).join('\n');

    return `<a class="skip-link" href="#main-content">${escapeHtml(ui('skipLink'))}</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${homeHref}">
      <span class="brand-mark" aria-hidden="true">DS</span>
      <span>${escapeHtml(data.profile.name)}</span>
    </a>
    <nav aria-label="${escapeHtml(ui('navLabel'))}">
      <ul class="nav-links">
${navLinks}
      </ul>
    </nav>
    <div class="header-actions">
      ${renderLanguageSwitcher(pageKey, outputPath)}
      <button type="button" class="icon-btn" id="theme-toggle" aria-pressed="false" aria-label="${escapeHtml(ui('themeToDark'))}" data-label-to-dark="${escapeHtml(ui('themeToDark'))}" data-label-to-light="${escapeHtml(ui('themeToLight'))}" data-text-dark="${escapeHtml(ui('themeLabelDark'))}" data-text-light="${escapeHtml(ui('themeLabelLight'))}">
        <span class="theme-label">${escapeHtml(ui('themeLabelDark'))}</span>
      </button>
      <a class="btn btn-primary btn-sm header-cv-btn" href="${escapeHtml(pdfHref)}" download>${escapeHtml(ui('downloadCv'))}</a>
      <button type="button" class="icon-btn nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="mobile-drawer" aria-label="${escapeHtml(ui('menuLabel'))}">
        ${escapeHtml(ui('menuButton'))}
      </button>
    </div>
  </div>
  <div id="mobile-drawer" class="mobile-drawer" hidden>
    <ul>
${mobileLinks}
      <li><a href="${escapeHtml(pdfHref)}" download>${escapeHtml(ui('downloadCvPdf'))}</a></li>
    </ul>
    ${renderLanguageSwitcher(pageKey, outputPath)}
  </div>
</header>`;
}

function renderFooter(data, { depth = 0, localeDepth = 0 } = {}) {
    const prefix = relPrefix(depth - localeDepth);
    return `<footer class="site-footer">
  <div class="container footer-inner">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(data.profile.name)} &middot; ${escapeHtml(data.profile.location)}</p>
    <div class="footer-links">
      <a href="${prefix}index.html">${escapeHtml(ui('footerPortfolio'))}</a>
      <a href="${prefix}cv/index.html">${escapeHtml(ui('footerCvVersions'))}</a>
      <a href="${escapeHtml(data.profile.contact.github)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui('footerGitHub'))}</a>
      <a href="${escapeHtml(data.profile.contact.linkedin)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui('footerLinkedIn'))}</a>
      <a href="mailto:${escapeHtml(data.profile.contact.email)}">${escapeHtml(ui('footerEmail'))}</a>
    </div>
  </div>
</footer>`;
}

// Document frame. outputPath is the page's file relative to the site root; pageKey names the page.
function renderDocument(data, options) {
    const {
        depth = 0,
        title,
        description,
        outputPath,
        pageKey,
        ogType = 'website',
        jsonLd = null,
        downloadHref = null,
        bodyHtml,
    } = options;

    const code = currentLocaleCode();
    const locale = localeInfo(code);
    const localeDepth = locale.dir ? 1 : 0;
    const prefix = relPrefix(depth);
    const canonicalUrl = `${data.site.baseUrl}/${outputPath.replace(/index\.html$/, '')}`;
    const ogImageUrl = `${data.site.baseUrl}/assets/images/og-preview.png`;

    const alternates = isTranslatedPage(pageKey)
        ? [
            ...LOCALES.map((item) => `  <link rel="alternate" hreflang="${item.htmlLang}" href="${escapeHtml(`${data.site.baseUrl}/${pageOutputPath(item.code, pageKey).replace(/index\.html$/, '')}`)}">`),
            `  <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${data.site.baseUrl}/${pageOutputPath('en', pageKey).replace(/index\.html$/, '')}`)}">`,
        ].join('\n')
        : '';

    const jsonLdBlock = jsonLd
        ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
        : '';

    return `<!DOCTYPE html>
<html lang="${locale.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(data.profile.name)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
${alternates}
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:locale" content="${OG_LOCALE[code]}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
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
${renderHeader(data, { depth, localeDepth, downloadHref, outputPath, pageKey })}
<div class="lang-hint" data-lang-hint data-template="${escapeHtml(ui('langHint', { language: '{language}' }))}" hidden><a href="#"></a></div>
<main id="main-content">
${bodyHtml}
</main>
${renderFooter(data, { depth, localeDepth })}
<script src="${prefix}assets/js/main.js" defer></script>
</body>
</html>
`;
}

module.exports = {
    renderDocument,
    defaultCvHref,
    NAV_ITEMS,
};
