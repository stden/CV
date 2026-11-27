const { escapeHtml: e, siteUrl, socialPreview } = require('./html');

function period(item) {
    return `${e(item.start)} – ${e(item.end)}`;
}

function renderRole(role, detailed, limit) {
    const details = detailed
        ? `<p>${e(role.summary)}</p>
           <ul>${role.highlights.slice(0, limit).map((text) => `<li>${e(text)}</li>`).join('')}</ul>`
        : `<p>${e(role.summary)}</p>`;
    const technologies = detailed && role.technologies.length
        ? `<p class="resume-technologies">${e(role.technologies.join(' · '))}</p>`
        : '';
    return `<article class="resume-entry">
        <h3>${e(role.role)} <span>· ${e(role.company)}</span></h3>
        <p class="resume-date">${period(role)}${role.location ? ` · ${e(role.location)}` : ''}</p>
        ${details}${technologies}
      </article>`;
}

function renderProject(project, detailed) {
    return `<article class="resume-entry">
        <h3>${e(project.title)} <span>· ${e(project.context)}</span></h3>
        <p>${e(project.architecture)}</p>
        ${detailed ? `<p>${e(project.reliability.join(' '))}</p>` : ''}
        <p class="resume-technologies">${e(project.technologies.join(' · '))}</p>
      </article>`;
}

function skillNames(group, variant, full) {
    const priority = new Set(variant.skillPriority ?? []);
    const first = group.entries.filter(({ id }) => priority.has(id));
    const remaining = group.entries.filter(({ id }) => !priority.has(id));
    const ranked = variant.slug === 'general' ? first : [...first, ...remaining].slice(0, 9);
    const entries = full ? group.entries : ranked;
    return entries.map(({ id, name, evidence }) => {
        if (id === 'apache-kafka') return `${name} (listed skill)`;
        return evidence.every(({ type }) => type === 'cv') ? `${name}*` : name;
    });
}

function renderResume(cv, variant, { stylesheet } = {}) {
    const standalone = stylesheet !== undefined;
    const full = !standalone && variant.slug === 'full';
    const canonical = `${siteUrl}cv/${variant.slug}/`;
    const summary = variant.summary || cv.summary;
    const title = `${cv.name} — ${variant.title}`;
    const groups = full ? cv.skills : variant.skills.map((id) => cv.skills.find((group) => group.id === id));
    const projects = variant.projects.map((id) => cv.projects.find((project) => project.id === id));
    const limits = [4, 2, 3];
    const skillGroups = groups.map((group) => ({ ...group, names: skillNames(group, variant, full || standalone) }));
    const hasListedSkills = skillGroups.some(({ names }) => names.some((name) => name.endsWith('*')));
    const skills = `<section aria-labelledby="skills">
      <h2 id="skills">Technical Skills</h2>
      <dl>${skillGroups.map((group) => `<div><dt>${e(group.title)}${group.id === 'ai' ? ' (independent work)' : ''}</dt><dd>${e(group.names.join(', '))}</dd></div>`).join('')}</dl>
      ${hasListedSkills ? '<p class="resume-note">* Listed in the earlier CV.</p>' : ''}
    </section>`;
    const experience = `<section aria-labelledby="experience">
      <h2 id="experience">Professional Experience</h2>
      ${cv.experience.slice(0, 3).map((role, index) => renderRole(role, true, full ? undefined : limits[index])).join('')}
    </section>`;
    const metadata = standalone ? `<meta name="robots" content="noindex, nofollow">
  <style>${stylesheet}</style>` : `<link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(summary)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${socialPreview}">
  <link rel="icon" href="../../favicon.ico">
  <link rel="stylesheet" href="../../assets/resume.css">`;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
  <meta name="description" content="${e(summary)}">
  ${metadata}
</head>
<body>
  <nav class="resume-actions" aria-label="Resume actions">
    <a href="${standalone ? siteUrl : '../../'}">Portfolio</a>
    <a class="resume-download" href="${standalone ? '' : '../../downloads/'}${e(variant.filename)}" download>Download CV (PDF)</a>
  </nav>
  <main>
    <header class="resume-header">
      <h1>${e(cv.name)}</h1>
      <p class="resume-title">${e(variant.title)}</p>
      <p class="resume-contact">${e(cv.location)} · <a href="mailto:${e(cv.contact.email)}">${e(cv.contact.email)}</a> ·
         <a href="${e(cv.contact.linkedin)}">LinkedIn</a> · <a href="${e(cv.contact.github)}">GitHub</a> ·
         <a href="${siteUrl}">Portfolio</a></p>
    </header>
    <section aria-labelledby="summary">
      <h2 id="summary">Professional Summary</h2>
      <p>${e(summary)}</p>
    </section>
    ${standalone || variant.slug === 'general' ? `${experience}\n    ${skills}` : `${skills}\n    ${experience}`}
    <section class="${full ? '' : 'resume-second-page'}" aria-labelledby="earlier">
      <h2 id="earlier">Earlier Experience</h2>
      ${cv.experience.slice(3).map((role) => renderRole(role, full)).join('')}
    </section>
    ${projects.length ? `<section aria-labelledby="projects">
      <h2 id="projects">Selected Projects</h2>
      ${projects.map((project) => renderProject(project, full)).join('')}
    </section>` : ''}
    <section aria-labelledby="education">
      <h2 id="education">Education</h2>
      ${cv.education.map((item) => `<p><strong>${e(item.degree)}</strong> · ${e(item.institution)} · ${period(item)}</p>`).join('')}
    </section>
    <section aria-labelledby="languages">
      <h2 id="languages">Languages</h2>
      <p>${cv.languages.map(({ name, level }) => `${e(name)} (${e(level)})`).join(' · ')}</p>
    </section>
  </main>
</body>
</html>
`;
}

module.exports = { renderResume };
