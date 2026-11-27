import { documentShell, escapeHtml } from '../lib/html.mjs';
import { svgHeight } from '../lib/diagram.mjs';

const KIND_LABEL = { professional: 'Work project', personal: 'Personal project' };

function list(items, empty) {
  if (!items.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function diagramSection(diagram, project) {
  if (!diagram) return '';
  const components = diagram.components
    .map((component, index) => `<li><strong>${escapeHtml(component.title)}.</strong> ${escapeHtml(component.role)}</li>`)
    .join('\n          ');
  return `<section aria-labelledby="architecture-diagram">
      <h2 id="architecture-diagram">Architecture diagram</h2>
      <figure class="diagram__figure diagram__figure--wide">
        <img src="../../assets/images/projects/${diagram.id}.svg" width="400" height="${svgHeight(diagram.components.length)}" alt="${escapeHtml(diagram.label)}" loading="lazy">
      </figure>
      <ol class="component-list">
          ${components}
      </ol>
      <p class="muted">Component names are generic. Concepts used here: ${diagram.concepts.map((id) => `<a href="../../#concept-${id}">${id.replace(/-/g, ' ')}</a>`).join(', ')}.</p>
    </section>`;
}

export function renderProjectPage(content, project) {
  const { cv, architecture, site } = content;
  const diagram = architecture.diagrams.find((item) => item.id === project.id);
  const pagePath = `projects/${project.id}/`;
  const body = `<article class="case-study" aria-labelledby="case-title">
  <div class="container case-study__inner">
    <p><a class="text-link" href="../../#projects">← Back to projects</a></p>
    <header>
      <p class="badge badge--${project.kind}">${KIND_LABEL[project.kind]}</p>
      <h1 id="case-title">${escapeHtml(project.title)}</h1>
      <p class="lead">${escapeHtml(project.summary)}</p>
      <p class="meta">Engineering context: ${escapeHtml(project.context)}</p>
    </header>
    <section aria-labelledby="problem-title">
      <h2 id="problem-title">Problem</h2>
      <p>${escapeHtml(project.problem)}</p>
    </section>
    <section aria-labelledby="architecture-title">
      <h2 id="architecture-title">Architecture</h2>
      <p>${escapeHtml(project.architecture)}</p>
    </section>
    ${diagramSection(diagram, project)}
    <section aria-labelledby="stack-title">
      <h2 id="stack-title">Technology stack</h2>
      <ul class="chips">${project.stack.map((item) => `<li class="chip">${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
    <section aria-labelledby="challenges-title">
      <h2 id="challenges-title">Technical challenges</h2>
      ${list(project.challenges, 'No challenges listed.')}
    </section>
    <section aria-labelledby="decisions-title">
      <h2 id="decisions-title">Design decisions</h2>
      ${list(project.decisions, 'No decisions listed.')}
    </section>
    <section aria-labelledby="reliability-title">
      <h2 id="reliability-title">Reliability considerations</h2>
      ${list(project.reliability, 'No reliability notes listed.')}
    </section>
    <section aria-labelledby="results-title">
      <h2 id="results-title">Results</h2>
      ${project.results.length
        ? list(project.results, '')
        : '<p class="muted">No throughput, user or cost figures are published for this project. The outcomes above describe how the system behaves.</p>'}
    </section>
    <p><a class="button button--ghost" href="../../downloads/Denis-Stepulenok-Full-CV.pdf" download>Download the full CV (PDF)</a></p>
  </div>
</article>`;
  return documentShell({
    title: `${project.title} — case study | ${cv.name}`,
    description: `${project.summary} ${project.context}.`,
    pagePath,
    prefix: '../../',
    site,
    body,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: project.title,
      description: project.summary,
      author: { '@type': 'Person', name: cv.name, url: `${site.origin}${site.basePath}` },
      url: `${site.origin}${site.basePath}${pagePath}`
    }],
    bodyClass: 'page-case-study',
    ogType: 'article'
  });
}
