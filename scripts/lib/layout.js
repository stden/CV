const { escapeHtml, relPrefix } = require('./utils');

// Compact navigation: four secondary pages, the CV versions, and the contact section on the homepage.
const NAV_ITEMS = [
    { id: 'experience', label: 'Experience', page: 'experience/index.html' },
    { id: 'projects', label: 'Projects', page: 'projects/index.html' },
    { id: 'skills', label: 'Skills', page: 'skills/index.html' },
    { id: 'architecture', label: 'Architecture', page: 'architecture/index.html' },
    { id: 'cv', label: 'CVs', page: 'cv/index.html' },
    { id: 'contact', label: 'Contact' },
];

function navHref(item, prefix) {
    return item.page ? `${prefix}${item.page}` : `${prefix}index.html#${item.id}`;
}

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cv-theme');if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches){t='dark';}if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(_){}})();`;

function defaultCvHref(data, depth = 0) {
    const general = data.variants.find(({ slug }) => slug === 'general');
    return `${relPrefix(depth)}assets/pdf/${general.pdfFilename}`;
}

function renderHeader(data, { depth = 0, downloadHref = null } = {}) {
    const prefix = relPrefix(depth);
    const homeHref = `${prefix}index.html`;
    const pdfHref = downloadHref || defaultCvHref(data, depth);

    const navLinks = NAV_ITEMS.map(
        (item) => `        <li><a href="${navHref(item, prefix)}">${escapeHtml(item.label)}</a></li>`
    ).join('\n');

    const mobileLinks = NAV_ITEMS.map(
        (item) => `      <li><a href="${navHref(item, prefix)}">${escapeHtml(item.label)}</a></li>`
    ).join('\n');

    return `<a class="skip-link" href="#main-content">Skip to main content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${homeHref}">
      <span class="brand-mark" aria-hidden="true">DS</span>
      <span>${escapeHtml(data.profile.name)}</span>
    </a>
    <nav aria-label="Primary navigation">
      <ul class="nav-links">
${navLinks}
      </ul>
    </nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="theme-toggle" aria-pressed="false" aria-label="Switch to dark theme">
        <span class="theme-label">Dark</span>
      </button>
      <a class="btn btn-primary btn-sm header-cv-btn" href="${escapeHtml(pdfHref)}" download>Download CV</a>
      <button type="button" class="icon-btn nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="mobile-drawer" aria-label="Toggle navigation menu">
        Menu
      </button>
    </div>
  </div>
  <div id="mobile-drawer" class="mobile-drawer" hidden>
    <ul>
${mobileLinks}
      <li><a href="${escapeHtml(pdfHref)}" download>Download CV (PDF)</a></li>
    </ul>
  </div>
</header>`;
}

function renderFooter(data, { depth = 0 } = {}) {
    const prefix = relPrefix(depth);
    return `<footer class="site-footer">
  <div class="container footer-inner">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(data.profile.name)} &middot; ${escapeHtml(data.profile.location)}</p>
    <div class="footer-links">
      <a href="${prefix}index.html">Portfolio</a>
      <a href="${prefix}cv/index.html">Targeted CVs</a>
      <a href="${escapeHtml(data.profile.contact.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="${escapeHtml(data.profile.contact.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href="mailto:${escapeHtml(data.profile.contact.email)}">Email</a>
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

    const prefix = relPrefix(depth);
    const canonicalUrl = canonicalPath
        ? `${data.site.baseUrl}/${canonicalPath}`
        : `${data.site.baseUrl}/`;
    const ogImageUrl = `${data.site.baseUrl}/assets/images/og-preview.png`;

    const jsonLdBlock = jsonLd
        ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(data.profile.name)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
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
${renderHeader(data, { depth, downloadHref })}
<main id="main-content">
${bodyHtml}
</main>
${renderFooter(data, { depth })}
<script src="${prefix}assets/js/main.js" defer></script>
</body>
</html>
`;
}

module.exports = {
    defaultCvHref,
    renderDocument,
};
