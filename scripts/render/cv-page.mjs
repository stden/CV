import { documentShell, escapeHtml } from '../lib/html.mjs';
import { highlightsFor, projectsFor, skillGroupsFor, splitSkills } from './shared.mjs';

// One column, plain text, standard headings: the same markup is the web page and
// the source of the PDF, so the ATS-friendly layout is not a separate template.

function contactLine(cv) {
  const { email, github, linkedin, telegram } = cv.contact;
  return [
    `<a href="mailto:${email}">${escapeHtml(email)}</a>`,
    `<a href="${github}" rel="noopener">github.com/stden</a>`,
    `<a href="${linkedin}" rel="noopener">linkedin.com/in/denis-stepulenok-2149b514</a>`,
    `<a href="${telegram}" rel="noopener">t.me/stdenx</a>`
  ].join(' · ');
}

function jobBlock(job, variant) {
  const highlights = highlightsFor(job, variant).map((highlight) => `<li>${escapeHtml(highlight.text)}</li>`).join('\n          ');
  return `<article class="job">
        <h3>${escapeHtml(job.role)}, ${escapeHtml(job.organisation)}</h3>
        <p class="meta">${escapeHtml(job.period)} · ${escapeHtml(job.location)}</p>
        <p>${escapeHtml(job.description)}</p>
        <ul>
          ${highlights}
        </ul>
      </article>`;
}

// Targeted versions stay short: one summary and the stack. The full CV adds the design decisions.
function projectBlock(project, variant) {
  const decisions = variant.slug === 'full'
    ? `<ul>\n          ${project.decisions.map((decision) => `<li>${escapeHtml(decision)}</li>`).join('\n          ')}\n        </ul>`
    : '';
  return `<article class="job">
        <h3>${escapeHtml(project.title)}</h3>
        <p class="meta">${escapeHtml(project.context)}</p>
        <p>${escapeHtml(project.summary)}</p>
        <p><strong>Stack:</strong> ${project.stack.map(escapeHtml).join(', ')}</p>
        ${decisions}
      </article>`;
}

function skillsBlock(cv, variant) {
  const { proven, other } = splitSkills(skillGroupsFor(cv, variant));
  const lines = proven.map((group) => `<p><strong>${escapeHtml(group.title)}:</strong> ${group.names.map(escapeHtml).join(', ')}</p>`);
  if (other.length) lines.push(`<p><strong>Other skills:</strong> ${other.map(escapeHtml).join(', ')}</p>`);
  return lines.join('\n      ');
}

function earlierBlock(cv) {
  const items = cv.earlierExperience
    .map((job) => `<li><strong>${escapeHtml(job.role)}</strong>, ${escapeHtml(job.organisation)} <span class="meta">(${escapeHtml(job.period)})</span></li>`)
    .join('\n          ');
  return `<section aria-labelledby="earlier-title">
      <h2 id="earlier-title">Earlier experience</h2>
      <ul>
          ${items}
      </ul>
    </section>`;
}

export function renderCvPage(content, variant, { stylesheet } = {}) {
  const { cv, site } = content;
  const experience = cv.experience.map((job) => jobBlock(job, variant)).join('\n      ');
  const projects = projectsFor(cv, variant).map((project) => projectBlock(project, variant)).join('\n      ');
  const languages = cv.languages.map((item) => `${escapeHtml(item.name)} (${escapeHtml(item.level)})`).join(', ');
  const pagePath = `cv/${variant.slug}/`;
  const summary = variant.summary ?? cv.summary;
  const standalone = stylesheet !== undefined;
  const portfolioUrl = standalone ? `${site.origin}${site.basePath}` : '../../';
  const pdfUrl = (standalone ? '' : '../../downloads/') + variant.pdf;
  const title = `${cv.name} — ${variant.title}`;
  const skillsSection = `<section aria-labelledby="skills-title">
      <h2 id="skills-title">Skills</h2>
      ${skillsBlock(cv, variant)}
    </section>`;
  const experienceSection = `<section aria-labelledby="experience-title">
      <h2 id="experience-title">Experience</h2>
      ${experience}
    </section>`;
  const prioritySections = standalone || variant.slug === 'general'
    ? [experienceSection, skillsSection]
    : [skillsSection, experienceSection];
  const body = `<article class="resume" aria-labelledby="resume-title">
  <div class="container resume__inner">
    <div class="resume__actions no-print">
      <a class="button button--primary" href="${escapeHtml(pdfUrl)}" download>Download PDF</a>
      <a class="text-link" href="${escapeHtml(portfolioUrl)}#overview">Back to portfolio</a>
    </div>
    <header class="resume__header">
      <h1 id="resume-title">${escapeHtml(cv.name)}</h1>
      <p class="resume__title">${escapeHtml(variant.title)}</p>
      <p class="meta">${escapeHtml(cv.location)}</p>
      <p class="meta resume__contact">${contactLine(cv)}</p>
    </header>
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Summary</h2>
      <p>${escapeHtml(summary)}</p>
    </section>
    ${prioritySections.join('\n    ')}
    ${earlierBlock(cv)}
    ${projects ? `<section aria-labelledby="projects-title">
      <h2 id="projects-title">Selected projects</h2>
      ${projects}
    </section>` : ''}
    <section aria-labelledby="education-title">
      <h2 id="education-title">Education</h2>
      ${cv.education.map((item) => `<p><strong>${escapeHtml(item.degree)}</strong>, ${escapeHtml(item.school)} <span class="meta">(${escapeHtml(item.period)})</span></p>`).join('\n      ')}
    </section>
    <section aria-labelledby="languages-title">
      <h2 id="languages-title">Languages</h2>
      <p>${languages}</p>
    </section>
  </div>
</article>`;
  if (standalone) return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${stylesheet}</style>
</head>
<body class="page-resume"><main>${body}</main></body>
</html>
`;
  return documentShell({
    title,
    description: `${variant.title}: ${summary.slice(0, 150)}`,
    pagePath,
    prefix: '../../',
    site,
    body,
    jsonLd: [resumeJsonLd(content, variant, pagePath)],
    bodyClass: 'page-resume'
  });
}

function resumeJsonLd(content, variant, pagePath) {
  const { cv, site } = content;
  const url = `${site.origin}${site.basePath}${pagePath}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', '@id': `${url}#profile`, url, name: variant.title, mainEntity: { '@id': `${site.origin}${site.basePath}#person` } },
      {
        '@type': 'Person',
        '@id': `${site.origin}${site.basePath}#person`,
        name: cv.name,
        jobTitle: variant.title,
        url: `${site.origin}${site.basePath}`,
        sameAs: [cv.contact.github, cv.contact.linkedin]
      }
    ]
  };
}
