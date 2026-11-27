const { escapeHtml: escape, siteUrl: canonicalUrl, socialPreview } = require('./html');
const { skills: skillsCatalogue } = require('../data/skills.json');

const portrait = 'assets/images/photo.jpg';
const navigation = [
  ['overview', 'Overview'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['architecture', 'Architecture'],
  ['education', 'Education'],
  ['contact', 'Contact'],
];
const techReference = skillsCatalogue.filter(({ techPage }) => techPage);
const techPages = new Map(techReference.map(({ name, techPage }) => [name.toLowerCase(), techPage]));

const iconPaths = {
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
  moon: '<path d="M20.5 15.1A8.5 8.5 0 1 1 8.9 3.5a6.7 6.7 0 0 0 11.6 11.6Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  location: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
};

function icon(name) {
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
}

function tagList(items, links = false) {
  if (!items?.length) return '';
  return `<ul class="chips">${items.map((item) => {
    const page = links && techPages.get(/^Java \d/.test(item) ? 'java' : item.toLowerCase());
    const tag = page
      ? `<a class="tag" href="${escape(page)}">${escape(item)}</a>`
      : `<span class="tag">${escape(item)}</span>`;
    return `<li>${tag}</li>`;
  }).join('')}</ul>`;
}

function bulletList(items) {
  return items?.length ? `<ul class="bullet-list">${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>` : '';
}

function sectionHead(id, title, intro) {
  return `<div class="section-heading">
    <h2 id="${id}-heading">${escape(title)}</h2>
    ${intro ? `<p>${escape(intro)}</p>` : ''}
  </div>`;
}

function downloadLink(variant, label, className) {
  return variant?.filename
    ? `<a class="${className}" href="downloads/${escape(variant.filename)}" download>${icon('download')}${escape(label)}${label === 'Download PDF' ? `<span class="visually-hidden"> for ${escape(variant.label || variant.title)}</span>` : ''}</a>`
    : '';
}

function socialLinks(contact) {
  return [
    ['LinkedIn', contact.linkedin],
    ['GitHub', contact.github],
  ].filter(([, url]) => url).map(([label, url]) => `<a href="${escape(url)}">${label}</a>`).join('');
}

function renderHeader(cv) {
  const navLinks = navigation.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('');
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="wordmark" href="#overview">${escape(cv.name)}</a>
    <nav class="primary-nav desktop-nav" aria-label="Primary navigation">${navLinks}</nav>
    <div class="header-actions">
      <a class="button button-small button-outline" href="#cv">CV versions</a>
      <button class="icon-button theme-toggle" type="button" data-theme-toggle aria-label="Dark theme" aria-pressed="false" title="Toggle colour theme" hidden>${icon('moon')}${icon('sun')}</button>
      <details class="mobile-menu" id="mobile-menu">
        <summary class="icon-button" aria-label="Navigation menu">${icon('menu')}</summary>
        <nav class="primary-nav mobile-nav" aria-label="Primary navigation">${navLinks}</nav>
      </details>
    </div>
  </div>
</header>`;
}

function renderOverview(cv, defaultVariant) {
  const availability = [
    cv.availability?.openToWork ? 'Open to work' : null,
    cv.availability?.relocation,
    cv.availability?.workAuthorization,
  ].filter((item) => typeof item === 'string' && item);
  return `<section class="overview section" id="overview" aria-labelledby="overview-heading">
    <div class="hero">
      <div class="hero-copy">
        <p class="location">${icon('location')}${escape(cv.location)}</p>
        <h1 id="overview-heading">${escape(cv.name)}</h1>
        <p class="hero-title">${escape(cv.title)}</p>
        <p class="hero-summary">${escape(cv.summary)}</p>
        ${tagList(cv.badges)}
        ${availability.length ? `<p class="availability">${availability.map(escape).join(' · ')}</p>` : ''}
        <div class="action-row hero-actions">
          ${downloadLink(defaultVariant, 'Download CV', 'button button-primary')}
          <a class="button button-outline" href="#contact">Contact</a>
        </div>
        <div class="inline-links">${socialLinks(cv.contact)}</div>
      </div>
      <div class="hero-portrait">
        <img src="${portrait}" alt="Portrait of ${escape(cv.name)}" width="363" height="480" decoding="async" fetchpriority="high">
      </div>
    </div>
    <div class="employer-strip">
      <p>Professional experience</p>
      <ul>${cv.experience.slice(0, 3).map((job) => `<li><a href="#${escape(job.id)}">${escape(job.company)}</a></li>`).join('')}</ul>
    </div>
    <div class="expertise">
      ${sectionHead('expertise', 'Key expertise')}
      <div class="expertise-grid">${cv.expertise.map(({ title, description }) => `<article class="expertise-card">
        <h3>${escape(title)}</h3>
        <p>${escape(description)}</p>
      </article>`).join('')}</div>
    </div>
  </section>`;
}

function renderJob(job) {
  const company = job.url
    ? `<a href="${escape(job.url)}">${escape(job.company)}</a>`
    : escape(job.company);
  return `<article class="job" id="${escape(job.id)}">
    <p class="job-date">${escape(job.start)} – ${escape(job.end)}</p>
    <div class="job-content">
      <h3>${escape(job.role)}</h3>
      <p class="company">${company}${job.location ? ` <span>· ${escape(job.location)}</span>` : ''}</p>
      <p>${escape(job.summary)}</p>
      ${bulletList(job.highlights)}
      ${tagList(job.technologies, true)}
    </div>
  </article>`;
}

function renderExperience(experience) {
  return `<section class="section" id="experience" aria-labelledby="experience-heading">
    ${sectionHead('experience', 'Professional experience')}
    <div class="timeline">${experience.slice(0, 3).map(renderJob).join('')}</div>
    ${experience.length > 3 ? `<details class="earlier-roles">
      <summary>Earlier experience <span class="subtle">(${experience.length - 3} roles)</span></summary>
      <div class="timeline">${experience.slice(3).map(renderJob).join('')}</div>
    </details>` : ''}
  </section>`;
}

function renderProject(project) {
  return `<article class="project" id="project-${escape(project.id)}">
    <p class="eyebrow">${escape(project.context)}</p>
    <h3>${escape(project.title)}</h3>
    <dl class="project-facts">
      <div><dt>Problem</dt><dd>${escape(project.problem)}</dd></div>
      <div><dt>Architecture</dt><dd>${escape(project.architecture)}</dd></div>
      ${project.result ? `<div><dt>Result</dt><dd>${escape(project.result)}</dd></div>` : ''}
    </dl>
    ${tagList(project.technologies, true)}
    <details class="case-study-details">
      <summary>Design decisions and reliability</summary>
      <h4>Design decisions</h4>
      ${bulletList(project.decisions)}
      <h4>Reliability</h4>
      ${bulletList(project.reliability)}
    </details>
    <a class="text-link" href="#architecture-${escape(project.id)}">Explore architecture</a>
  </article>`;
}

function renderPublicProject({ name, language, description, repository, documentation, ci, ciResult, activity }) {
  return `<article class="public-project">
    ${language ? `<p class="eyebrow">${escape(language)}</p>` : ''}
    <h4>${escape(name)}</h4>
    <p>${escape(description)}</p>
    ${activity ? `<p class="project-status">Latest activity · <time datetime="${escape(activity)}">${escape(activity)}</time></p>` : ''}
    ${ciResult ? `<p class="project-status"><a href="${escape(ciResult.url)}">CI passed</a> · <time datetime="${escape(ciResult.date)}">${escape(ciResult.date)}</time></p>` : ''}
    <div class="inline-links">
      <a href="${escape(repository)}">Repository<span class="visually-hidden"> for ${escape(name)}</span></a>
      ${documentation ? `<a href="${escape(documentation)}">Documentation<span class="visually-hidden"> for ${escape(name)}</span></a>` : ''}
      ${ci ? `<a href="${escape(ci)}">CI workflow<span class="visually-hidden"> for ${escape(name)}</span></a>` : ''}
    </div>
  </article>`;
}

function renderProjects(projects, publicProjects) {
  return `<section class="section" id="projects" aria-labelledby="projects-heading">
    ${sectionHead('projects', 'Selected projects')}
    <div class="project-grid">${projects.map(renderProject).join('')}</div>
    ${publicProjects.length ? `<div class="public-projects">
      <h3>Public repositories</h3>
      <div class="public-project-grid">${publicProjects.map(renderPublicProject).join('')}</div>
    </div>` : ''}
  </section>`;
}

function renderSkills(skills) {
  return `<section class="section" id="skills" aria-labelledby="skills-heading">
    ${sectionHead('skills', 'Technical skills')}
    <div class="skills-grid">${skills.map(({ title, scope, items }) => `<article class="skill-group">
      <p class="eyebrow">${escape(scope)}</p>
      <h3>${escape(title)}</h3>
      ${tagList(items, true)}
    </article>`).join('')}</div>
    <details class="tech-reference">
      <summary>Technology reference pages</summary>
      ${tagList(techReference.map(({ name }) => name), true)}
    </details>
    <p><a class="text-link" href="skills.json">Complete skills catalogue (JSON)</a></p>
  </section>`;
}

function renderDiagram({ id, title, diagram }) {
  const src = `assets/images/projects/${escape(id)}.svg`;
  return `<article class="architecture-card" id="architecture-${escape(id)}">
    <h3>${escape(title)}</h3>
    <div class="architecture-body">
      <figure class="architecture-figure">
        <img src="${src}" alt="${escape(diagram.label)}" loading="lazy" decoding="async">
        <figcaption><a class="text-link" href="${src}">View full diagram<span class="visually-hidden"> for ${escape(title)}</span></a></figcaption>
      </figure>
      <div class="architecture-steps">
        <h4>Components</h4>
        ${diagram.steps.map(({ title: stepTitle, detail }) => `<details>
          <summary>${escape(stepTitle)}</summary>
          <p>${escape(detail)}</p>
        </details>`).join('')}
      </div>
    </div>
  </article>`;
}

function renderArchitecture(projects, backgroundProcessing) {
  const diagrams = [...projects, backgroundProcessing].filter((item) => item?.diagram);
  return `<section class="section" id="architecture" aria-labelledby="architecture-heading">
    ${sectionHead('architecture', 'Architecture portfolio', 'Inspect each component to see how data moves through the system and where reliability checks happen.')}
    <div class="architecture-grid">${diagrams.map(renderDiagram).join('')}</div>
  </section>`;
}

function renderEducation(cv) {
  return `<section class="section" id="education" aria-labelledby="education-heading">
    ${sectionHead('education', 'Education and languages')}
    <div class="education-grid">
      ${cv.education.map(({ degree, institution, start, end }) => `<article class="education-card">
        <h3>${escape(degree)}</h3>
        <p>${escape(institution)}</p>
        <p class="subtle">${escape(start)} – ${escape(end)}</p>
      </article>`).join('')}
      ${cv.languages.length ? `<div class="education-card">
        <h3>Languages</h3>
        <dl class="language-list">${cv.languages.map(({ name, level }) => `<div><dt>${escape(name)}</dt><dd>${escape(level)}</dd></div>`).join('')}</dl>
      </div>` : ''}
      ${cv.interests.length ? `<div class="education-card">
        <h3>Interests</h3>
        <p>${cv.interests.map(escape).join(' · ')}</p>
      </div>` : ''}
    </div>
  </section>`;
}

function renderVariants(variants) {
  return `<section class="section" id="cv" aria-labelledby="cv-heading">
    ${sectionHead('cv', 'CV versions', 'Choose a version for the role and download it as a PDF.')}
    <div class="variant-grid">${variants.map((variant) => `<article class="variant-card">
      <h3><a href="cv/${escape(variant.slug)}/">${escape(variant.label || variant.title)}</a></h3>
      ${variant.summary ? `<p>${escape(variant.summary)}</p>` : ''}
      <div class="inline-links">
        <a href="cv/${escape(variant.slug)}/">View CV<span class="visually-hidden"> for ${escape(variant.label || variant.title)}</span></a>
        ${downloadLink(variant, 'Download PDF', 'text-link download-link')}
      </div>
    </article>`).join('')}</div>
  </section>`;
}

function renderContact(cv, defaultVariant) {
  const { email, telegram } = cv.contact;
  return `<section class="section contact-section" id="contact" aria-labelledby="contact-heading">
    <div class="contact-panel">
      <div>
        <h2 id="contact-heading">Contact</h2>
        ${email ? `<p class="contact-email"><a href="mailto:${escape(email)}">${escape(email)}</a></p>` : ''}
        <p class="location">${icon('location')}${escape(cv.location)}</p>
      </div>
      <div>
        <div class="action-row">
          ${email ? `<a class="button button-primary" href="mailto:${escape(email)}">Send email</a>
          <button class="button button-outline" type="button" data-copy-email="${escape(email)}" hidden>${icon('copy')}Copy email address</button>` : ''}
        </div>
        <div class="inline-links">
          ${socialLinks(cv.contact)}
          ${telegram ? `<a href="${escape(telegram)}">Telegram</a>` : ''}
          ${downloadLink(defaultVariant, 'Download CV', 'text-link download-link')}
        </div>
        <p class="copy-status" role="status" data-copy-status></p>
      </div>
    </div>
  </section>`;
}

function renderPortfolio(cv, variants) {
  const defaultVariant = variants.find(({ slug }) => slug === 'general');
  const pageTitle = `${cv.name} · ${cv.title}`;
  const description = `${cv.name}, Senior Software Engineer in ${cv.location}. Java backend development, distributed systems, enterprise integration and AI engineering.`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: pageTitle,
    description,
    mainEntity: {
      '@type': 'Person',
      '@id': `${canonicalUrl}#person`,
      name: cv.name,
      url: canonicalUrl,
      jobTitle: cv.title,
      image: `${canonicalUrl}${portrait}`,
      sameAs: [cv.contact.linkedin, cv.contact.github, cv.contact.telegram].filter(Boolean),
    },
  };
  const json = JSON.stringify(structuredData).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(pageTitle)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" href="favicon.ico">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${escape(cv.name)}">
  <meta property="og:title" content="${escape(pageTitle)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${socialPreview}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escape(cv.name)} — ${escape(cv.title)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(pageTitle)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${canonicalUrl}${portrait}">
  <script type="application/ld+json">${json}</script>
  <link rel="preload" href="assets/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/portfolio.css">
  <script src="assets/portfolio.js" defer></script>
</head>
<body>
  ${renderHeader(cv)}
  <main id="main" class="container" tabindex="-1">
    ${renderOverview(cv, defaultVariant)}
    ${renderExperience(cv.experience)}
    ${renderProjects(cv.projects, cv.openSource)}
    ${renderSkills(cv.skills)}
    ${renderArchitecture(cv.projects, cv.backgroundProcessing)}
    ${renderEducation(cv)}
    ${renderVariants(variants)}
    ${renderContact(cv, defaultVariant)}
  </main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <a class="wordmark" href="#overview">${escape(cv.name)}</a>
      <a href="#overview">Back to overview</a>
    </div>
  </footer>
</body>
</html>
`;
}

module.exports = { renderPortfolio };
