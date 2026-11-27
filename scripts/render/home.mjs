import { documentShell, escapeHtml } from '../lib/html.mjs';
import { svgHeight } from '../lib/diagram.mjs';
import { contactActions, evidenceLegend, skillChips } from './shared.mjs';

const PHOTO = { width: 363, height: 480 };

function canonicalLink(site, path) {
  return `${site.origin}${site.basePath}${path}`;
}

function heroSection(cv, site) {
  const availability = site.availability.showOpenToWork
    ? `<p class="availability"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(site.availability.message)}</p>`
    : '';
  return `<section id="overview" class="hero" aria-labelledby="hero-name">
  <div class="container hero__grid">
    <div class="hero__text">
      <p class="eyebrow">${escapeHtml(cv.location)}</p>
      <h1 id="hero-name">${escapeHtml(cv.name)}</h1>
      <p class="hero__title">${escapeHtml(cv.headline)}</p>
      <p class="hero__summary">${escapeHtml(cv.summary)}</p>
      <ul class="badges" aria-label="Core technologies">
        ${cv.badges.map((badge) => `<li>${escapeHtml(badge)}</li>`).join('\n        ')}
      </ul>
      <div class="actions">
        <a class="button button--primary" href="downloads/${escapeHtml(site.defaultCvPdf)}" download>Download CV (PDF)</a>
        <a class="button button--ghost" href="#contact">Contact</a>
        <a class="text-link" href="${cv.contact.github}" rel="me noopener">GitHub</a>
        <a class="text-link" href="${cv.contact.linkedin}" rel="me noopener">LinkedIn</a>
      </div>
      ${availability}
    </div>
    <figure class="hero__photo">
      <img src="assets/images/photo.jpg" width="${PHOTO.width}" height="${PHOTO.height}" alt="Portrait of ${escapeHtml(cv.name)}" fetchpriority="high">
    </figure>
  </div>
</section>`;
}

function expertiseSection(cv) {
  const cards = cv.expertise
    .map((item) => `<article class="card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>`)
    .join('\n        ');
  return `<section class="section container" aria-labelledby="expertise-title">
  <h2 id="expertise-title">Key expertise</h2>
  <div class="card-grid card-grid--expertise">
        ${cards}
  </div>
</section>`;
}

function jobItem(job, featured) {
  const organisation = job.url
    ? `<a href="${job.url}" rel="noopener">${escapeHtml(job.organisation)}</a>`
    : escapeHtml(job.organisation);
  const current = featured && job.period.includes('Present') ? '<span class="badge">Current role</span>' : '';
  return `<li class="timeline__item${featured ? ' timeline__item--featured' : ''}">
          <div class="timeline__meta">
            <p class="timeline__period">${escapeHtml(job.period)}</p>
            <p class="timeline__location">${escapeHtml(job.location)}</p>
          </div>
          <div class="timeline__body">
            <h3>${escapeHtml(job.role)} ${current}</h3>
            <p class="timeline__org">${organisation}</p>
            <p>${escapeHtml(job.description)}</p>
            <ul class="highlights">
              ${job.highlights.map((highlight) => `<li>${escapeHtml(highlight.text)}</li>`).join('\n              ')}
            </ul>
            <p class="tech-list"><strong>Technologies in this role:</strong> ${job.technologies.map(escapeHtml).join(', ')}</p>
          </div>
        </li>`;
}

function earlierItem(job) {
  const organisation = job.url
    ? `<a href="${job.url}" rel="noopener">${escapeHtml(job.organisation)}</a>`
    : escapeHtml(job.organisation);
  return `<li>
              <p class="earlier__head"><strong>${escapeHtml(job.role)}</strong>, ${organisation}
              <span class="earlier__period">${escapeHtml(job.period)}</span></p>
              <p>${escapeHtml(job.description)}</p>
              <p class="tech-list">${job.technologies.map(escapeHtml).join(', ')}</p>
            </li>`;
}

function experienceSection(cv) {
  const current = cv.experience.map((job) => jobItem(job, job.featured)).join('\n        ');
  const earlier = cv.earlierExperience.map(earlierItem).join('\n            ');
  return `<section id="experience" class="section container" aria-labelledby="experience-title">
  <h2 id="experience-title">Experience</h2>
  <ol class="timeline">
        ${current}
  </ol>
  <details class="earlier">
    <summary>Earlier experience (${cv.earlierExperience.length} roles, 2001 – 2014)</summary>
    <ol class="earlier__list">
            ${earlier}
    </ol>
  </details>
</section>`;
}

function projectCard(project) {
  const kind = project.kind === 'professional' ? 'Work project' : 'Personal project';
  return `<article class="card project-card">
          <p class="badge badge--${project.kind}">${kind}</p>
          <h3><a href="projects/${project.id}/">${escapeHtml(project.title)}</a></h3>
          <p class="meta">${escapeHtml(project.context)}</p>
          <p>${escapeHtml(project.summary)}</p>
          <p class="tech-list">${project.stack.map(escapeHtml).join(' · ')}</p>
          <p><a class="text-link" href="projects/${project.id}/">Read the case study</a></p>
        </article>`;
}

function githubCard(project, owner) {
  const repo = `https://github.com/${owner}/${project.repo}`;
  return `<article class="card">
          <h3><a href="${repo}" rel="noopener">${escapeHtml(project.title)}</a></h3>
          <p>${escapeHtml(project.description)}</p>
          <dl class="facts">
            <div><dt>Language</dt><dd>${escapeHtml(project.language)}</dd></div>
            <div><dt>Last commit</dt><dd>${project.lastCommit}</dd></div>
            <div><dt>CI</dt><dd>${escapeHtml(project.ci)}</dd></div>
          </dl>
          <p><a class="text-link" href="${repo}" rel="noopener">Repository</a> · <a class="text-link" href="${repo}#readme" rel="noopener">Documentation (README)</a></p>
        </article>`;
}

function projectsSection(cv, github) {
  const cards = cv.projects.map(projectCard).join('\n        ');
  const repos = github.projects.map((project) => githubCard(project, 'stden')).join('\n        ');
  return `<section id="projects" class="section container" aria-labelledby="projects-title">
  <h2 id="projects-title">Selected projects</h2>
  <div class="card-grid">
        ${cards}
  </div>
  <h3 class="subsection-title">Selected public GitHub projects</h3>
  <p class="muted">Snapshot from ${github.snapshot}. Language, last commit and CI status are copied from GitHub on that date.</p>
  <div class="card-grid">
        ${repos}
  </div>
</section>`;
}

function skillsSection(cv) {
  const groups = cv.skillGroups
    .map((group) => `<article class="skill-group">
          <h3>${escapeHtml(group.title)}</h3>
          <ul class="chips">
          ${skillChips(group)}
          </ul>
        </article>`)
    .join('\n        ');
  return `<section id="skills" class="section container" aria-labelledby="skills-title">
  <h2 id="skills-title">Skills</h2>
  <p class="muted">Skills are grouped by area. Each one is marked by where it was used.</p>
  ${evidenceLegend()}
  <div class="card-grid card-grid--skills">
        ${groups}
  </div>
</section>`;
}

function componentItem(component, index) {
  return `<details class="component">
              <summary>${index + 1}. ${escapeHtml(component.title)}</summary>
              <p>${escapeHtml(component.detail)}</p>
              <p class="muted">${escapeHtml(component.role)}</p>
            </details>`;
}

function diagramBlock(diagram, project) {
  const concepts = diagram.concepts.map((id) => `<a href="#concept-${id}">${id.replace(/-/g, ' ')}</a>`).join(', ');
  return `<article class="diagram" aria-labelledby="diagram-${diagram.id}">
          <h3 id="diagram-${diagram.id}">${escapeHtml(diagram.title)}</h3>
          <p>${escapeHtml(diagram.summary)}</p>
          <div class="diagram__grid">
            <figure class="diagram__figure">
              <img src="assets/images/projects/${diagram.id}.svg" width="400" height="${svgHeight(diagram.components.length)}" alt="${escapeHtml(diagram.label)}" loading="lazy">
            </figure>
            <div class="components" aria-label="Components of ${escapeHtml(project.title)}">
              ${diagram.components.map(componentItem).join('\n              ')}
            </div>
          </div>
          <p class="concepts">Concepts: ${concepts}. <a class="text-link" href="projects/${project.id}/">Case study</a></p>
        </article>`;
}

function conceptList(architecture) {
  return architecture.concepts
    .map((concept) => `<div id="concept-${concept.id}" class="concept">
          <dt>${escapeHtml(concept.title)}</dt>
          <dd>${escapeHtml(concept.text)} <span class="where">Where: ${escapeHtml(concept.where)}</span></dd>
        </div>`)
    .join('\n        ');
}

function architectureSection(cv, architecture) {
  const diagrams = architecture.diagrams
    .map((diagram) => diagramBlock(diagram, cv.projects.find((project) => project.id === diagram.id)))
    .join('\n        ');
  return `<section id="architecture" class="section container" aria-labelledby="architecture-title">
  <h2 id="architecture-title">Architecture</h2>
  <p class="muted">Each component opens to show its responsibility. Component names are generic; no production endpoints or internal identifiers are shown.</p>
  ${diagrams}
  <h3 class="subsection-title">Engineering concepts</h3>
  <dl class="concept-list">
        ${conceptList(architecture)}
  </dl>
</section>`;
}

function educationSection(cv) {
  const education = cv.education
    .map((item) => `<li><p><strong>${escapeHtml(item.degree)}</strong>, ${escapeHtml(item.school)}</p><p class="muted">${escapeHtml(item.period)}</p></li>`)
    .join('\n          ');
  const languages = cv.languages.map((item) => `<li>${escapeHtml(item.name)} <span class="muted">(${escapeHtml(item.level)})</span></li>`).join('\n          ');
  return `<section id="education" class="section container" aria-labelledby="education-title">
  <h2 id="education-title">Education</h2>
  <ul class="plain-list">
          ${education}
  </ul>
  <h3 class="subsection-title">Languages</h3>
  <ul class="plain-list">
          ${languages}
  </ul>
  <h3 class="subsection-title">Interests</h3>
  <p>${cv.interests.map(escapeHtml).join(', ')}</p>
</section>`;
}

function availabilityList(site) {
  const { relocation, workAuthorisation } = site.availability;
  const items = [
    relocation ? `<li><strong>Relocation:</strong> ${escapeHtml(relocation)}</li>` : '',
    workAuthorisation ? `<li><strong>Work authorisation:</strong> ${escapeHtml(workAuthorisation)}</li>` : ''
  ].filter(Boolean);
  return items.length ? `<ul class="plain-list">${items.join('')}</ul>` : '';
}

function variantLinks(content) {
  return content.variants
    .map((variant) => `<li><a href="cv/${variant.slug}/">${escapeHtml(variant.title)}</a>
            <span class="muted">·</span> <a class="text-link" href="downloads/${variant.pdf}" download>${variant.pdf === content.site.defaultCvPdf ? 'Download general CV (PDF)' : 'PDF'}</a></li>`)
    .join('\n          ');
}

function contactSection(content) {
  const { cv, site } = content;
  return `<section id="contact" class="section container" aria-labelledby="contact-title">
  <h2 id="contact-title">Contact</h2>
  <p class="contact-email">Email: <a href="mailto:${cv.contact.email}">${escapeHtml(cv.contact.email)}</a></p>
  <div class="actions">
        ${contactActions(cv)}
  </div>
  <p class="muted">Also on <a href="${cv.contact.facebook}" rel="noopener">Facebook</a>.</p>
  ${availabilityList(site)}
  <h3 class="subsection-title">CV versions</h3>
  <p class="muted">Each version uses the same verified facts, with a different selection of skills and projects.</p>
  <ul class="plain-list cv-links">
          ${variantLinks(content)}
  </ul>
</section>`;
}


function jsonLd(content, pagePath) {
  const { cv, site } = content;
  const home = canonicalLink(site, pagePath);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${home}#profile`,
        url: home,
        name: cv.headline,
        mainEntity: { '@id': `${home}#person` }
      },
      {
        '@type': 'Person',
        '@id': `${home}#person`,
        name: cv.name,
        jobTitle: 'Senior Software Engineer',
        description: cv.summary,
        url: home,
        sameAs: [cv.contact.github, cv.contact.linkedin, cv.contact.telegram],
        address: { '@type': 'PostalAddress', addressLocality: 'Tallinn', addressCountry: 'EE' },
        alumniOf: cv.education.map((item) => ({ '@type': 'EducationalOrganization', name: item.school })),
        worksFor: { '@type': 'Organization', name: cv.experience[0].organisation, url: cv.experience[0].url },
        knowsAbout: cv.badges
      }
    ]
  };
}

export function renderHome(content) {
  const { cv, architecture, github, site } = content;
  const body = [
    heroSection(cv, site),
    expertiseSection(cv),
    experienceSection(cv),
    projectsSection(cv, github),
    skillsSection(cv),
    architectureSection(cv, architecture),
    educationSection(cv),
    contactSection(content)
  ].join('\n\n');
  return documentShell({
    title: `${cv.name} — ${cv.headline}`,
    description: `${cv.name}, Senior Software Engineer based in Tallinn, Estonia. Java backend, distributed systems, enterprise integration and AI engineering. Experience at Kuehne+Nagel, Oracle and Taxify (Bolt).`,
    pagePath: '',
    prefix: '',
    site,
    body,
    jsonLd: [jsonLd(content, '')],
    bodyClass: 'page-home'
  });
}
