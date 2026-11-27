const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, escapeXml, loadCvData, relPrefix } = require('./lib/utils');
const { defaultCvHref, renderDocument } = require('./lib/layout');
const { DETAIL_PAGES } = require('./lib/public-artifact');
const { renderInteractiveSvg } = require('./build-project-diagrams');

function copyFonts() {
    const src = path.join(ROOT_DIR, 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
    const dstDir = path.join(ROOT_DIR, 'assets', 'fonts');
    fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(src, path.join(dstDir, 'inter-latin-wght-normal.woff2'));
}

function buildTechSlugLookup(data) {
    const map = new Map();
    for (const t of data.technologies) {
        map.set(t.slug, t.slug);
        map.set(t.title.toLowerCase(), t.slug);
    }
    map.set('java (6–25)', 'java');
    map.set('java 6–25', 'java');
    map.set('java core', 'java');
    map.set('jdk', 'java');
    map.set('spring framework', 'spring');
    map.set('spring', 'spring');
    map.set('spring boot', 'spring-boot');
    map.set('jpa / hibernate', 'jpa');
    map.set('hibernate', 'hibernate');
    map.set('oracle database', 'oracle');
    map.set('postgresql', 'postgresql');
    map.set('sql', 'sql');
    map.set('docker / compose', 'docker');
    map.set('docker', 'docker');
    map.set('kubernetes / helm', 'kubernetes');
    map.set('kubernetes', 'kubernetes');
    map.set('jenkins', 'jenkins');
    map.set('gitlab ci/cd', 'gitlab');
    map.set('gitlab', 'gitlab');
    map.set('maven', 'maven');
    map.set('git', 'git');
    map.set('python (2 & 3)', 'python');
    map.set('python 2/3 scripting', 'python');
    map.set('python', 'python');
    map.set('angularjs', 'angular');
    map.set('react', 'react');
    map.set('mockito', 'mockito');
    map.set('mockito / jmockit / easymock', 'mockito');
    map.set('jmockit', 'jmockit');
    map.set('easymock', 'easymock');
    return map;
}

function renderTechChips(items, techLookup, depth = 0) {
    const prefix = relPrefix(depth);
    return items.map((item) => {
        const key = item.toLowerCase();
        const slug = techLookup.get(key);
        if (slug) {
            return `<li><a class="badge" href="${prefix}tech/${escapeHtml(slug)}.html">${escapeHtml(item)}</a></li>`;
        }
        return `<li><span class="badge">${escapeHtml(item)}</span></li>`;
    }).join('');
}

function renderHero(data) {
    const { profile } = data;
    const avail = profile.availability || {};
    const availabilityHtml = avail.showOpenToWork && avail.statusText
        ? `\n      <p class="hero-availability">${escapeHtml(avail.statusText)}${avail.workAuthorisation ? ` &middot; ${escapeHtml(avail.workAuthorisation)}` : ''}${avail.relocation ? ` &middot; ${escapeHtml(avail.relocation)}` : ''}</p>`
        : '';

    return `<section id="overview" class="hero">
  <div class="container hero-grid">
    <div>
      <p class="hero-location">${escapeHtml(profile.location)}</p>
      <h1 class="hero-name">${escapeHtml(profile.name)}</h1>
      <p class="hero-role">${escapeHtml(profile.title)}</p>${availabilityHtml}
      <p class="hero-summary">${escapeHtml(profile.summary)}</p>
      <p class="hero-secondary">${profile.coreBadges.map(escapeHtml).join(' · ')}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="${escapeHtml(defaultCvHref(data))}" download>Download CV (PDF)</a>
        <a class="btn btn-secondary" href="#contact">Contact</a>
      </div>
      <p class="recruiter-more"><a href="${escapeHtml(profile.contact.linkedin)}">LinkedIn</a> · <a href="${escapeHtml(profile.contact.github)}">GitHub</a></p>
    </div>
    <div class="hero-photo-wrap">
      <img class="hero-photo" src="${escapeHtml(profile.photo)}" alt="${escapeHtml(profile.photoAlt)}" width="${profile.photoWidth}" height="${profile.photoHeight}" decoding="async">
    </div>
  </div>
</section>`;
}

function renderExpertise(data) {
    const cards = data.expertise.map((card) => `      <article class="card">
        <h3 class="card-title">${escapeHtml(card.title)}</h3>
        <p class="card-body">${escapeHtml(card.description)}</p>
      </article>`).join('\n');

    return `<section class="section section-alt" aria-labelledby="expertise-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Core Capabilities</p>
      <h2 id="expertise-heading" class="section-title">Key Engineering Expertise</h2>
      <p class="section-lead">Backend systems, asynchronous integration, and production reliability built on enterprise Java and polyglot tooling.</p>
    </div>
    <div class="expertise-grid">
${cards}
    </div>
  </div>
</section>`;
}

function renderExperience(data, techLookup, depth) {
    const primary = data.experience.filter((r) => !r.compact);
    const earlier = data.experience.filter((r) => r.compact);

    const primaryHtml = primary.map((role) => {
        const companyLabel = role.url
            ? `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(role.company)}</a>`
            : escapeHtml(role.company);
        const note = role.companyNote ? ` &middot; ${escapeHtml(role.companyNote)}` : '';
        const approved = (role.verifiedAchievements || []).filter(({ publicApproved }) => publicApproved === true);
        const bullets = [...role.responsibilities, ...approved.map(({ text }) => text)]
            .map((r) => `          <li>${escapeHtml(r)}</li>`).join('\n');
        const moreTechnologies = role.additionalTechnologies || [];
        const additionalBlock = moreTechnologies.length
            ? `<details class="recruitment-disclosure">
            <summary>Additional role technologies</summary>
            <ul class="badge-list">${renderTechChips(moreTechnologies, techLookup, depth)}</ul>
          </details>`
            : '';

        return `      <article class="role-card" id="role-${escapeHtml(role.id)}">
        <div class="role-header">
          <h3 class="role-title">${escapeHtml(role.role)}</h3>
          <span class="role-period">${escapeHtml(role.period)}</span>
        </div>
        <p class="role-company">${companyLabel} &middot; ${escapeHtml(role.location)}${note}</p>
        <p class="role-summary">${escapeHtml(role.summary)}</p>
        <ul class="bullet-list">
${bullets}
        </ul>
        <div class="tech-group">
          <span class="tech-group-label">Primary technologies in role</span>
          <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, depth)}</ul>
        </div>
        ${additionalBlock}
      </article>`;
    }).join('\n');

    const earlierHtml = earlier.map((role) => {
        const companyText = role.url
            ? `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(role.company)}</a>`
            : escapeHtml(role.company);
        const bullets = role.responsibilities.map((r) => `            <li>${escapeHtml(r)}</li>`).join('\n');
        return `        <details class="compact-role" id="role-${escapeHtml(role.id)}">
          <summary>
            <span class="compact-summary-left">
              <span>${escapeHtml(role.role)}</span>
              <span class="compact-company">&middot; ${escapeHtml(role.company)} (${escapeHtml(role.period)})</span>
            </span>
            <span class="compact-chevron" aria-hidden="true"></span>
          </summary>
          <div class="compact-body">
            <p class="role-company">${companyText} &middot; ${escapeHtml(role.location)}</p>
            <p class="role-summary">${escapeHtml(role.summary)}</p>
            <ul class="bullet-list">
${bullets}
            </ul>
            <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, depth)}</ul>
          </div>
        </details>`;
    }).join('\n');

    return `<section id="experience" class="section" aria-labelledby="experience-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Career Timeline</p>
      <h2 id="experience-heading" class="section-title">Professional Experience</h2>
      <p class="section-lead">Chronological engineering record across enterprise Java backend platforms, high-load microservices, and JDK quality infrastructure.</p>
    </div>
    <div class="timeline">
${primaryHtml}
    </div>
    <div class="earlier-roles">
      <h3 class="earlier-roles-heading">Earlier Engineering Roles (2001 – 2014)</h3>
      <div class="earlier-list">
${earlierHtml}
      </div>
    </div>
  </div>
</section>`;
}

function renderProvenance(provenance) {
    const { summary, sourceUrl } = provenance;
    return `<p class="provenance">${escapeHtml(summary)}${sourceUrl ? ` <a href="${escapeHtml(sourceUrl)}">Source repository</a>` : ''}</p>`;
}

function renderProjectPreview(repo, prefix = '', includeSource = false) {
    if (!repo?.previewImage) return '';
    const source = includeSource && repo.previewSourceUrl
        ? ` <a href="${escapeHtml(repo.previewSourceUrl)}">Source</a>`
        : '';
    return `<figure class="project-preview">
        <img src="${prefix}${escapeHtml(repo.previewImage)}" alt="${escapeHtml(repo.previewAlt)}" width="640" height="360" loading="lazy" decoding="async">
        <figcaption>${escapeHtml(repo.previewCaption)}${source}</figcaption>
      </figure>`;
}

function renderProjects(data, depth) {
    const prefix = relPrefix(depth);
    const casesHtml = data.caseStudies.map((cs) => {
        const scopeClass = cs.scopeType === 'personal' ? 'case-scope case-scope-personal' : 'case-scope';
        const stackBadges = cs.stack.map((s) => `<li><span class="badge">${escapeHtml(s)}</span></li>`).join('');
        const challenges = cs.challenges.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
        const decisions = cs.decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
        const reliability = cs.reliability.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
        const results = cs.results.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
        const diagram = cs.diagramSlug
            ? `<div class="case-diagram-box">
            <img src="${prefix}assets/images/projects/${escapeHtml(cs.diagramSlug)}.svg" alt="${escapeHtml(cs.title)} architecture flow diagram" loading="lazy" width="420" height="580">
            <p class="case-diagram-caption"><a href="${prefix}architecture/#arch-tab-${escapeHtml(cs.diagramSlug)}">Find this diagram in the architecture portfolio</a></p>
          </div>`
            : '';

        return `      <article class="case-card" id="case-${escapeHtml(cs.id)}">
        <span class="${scopeClass}">${escapeHtml(cs.scope)}</span>
        <h3 class="case-title">${escapeHtml(cs.title)}</h3>
        <p class="case-intro">${escapeHtml(cs.problem)}</p>
        ${renderProvenance(cs.provenance)}
        <details class="recruitment-disclosure">
          <summary>Engineering details</summary>
        <div class="case-columns">
          <div>
            <dl class="case-dl">
              <div><dt>Engineering Context</dt><dd>${escapeHtml(cs.context)}</dd></div>
              <div><dt>Architecture</dt><dd>${escapeHtml(cs.architecture)}</dd></div>
              <div><dt>Technical Challenges</dt><dd><ul class="bullet-list">${challenges}</ul></dd></div>
              <div><dt>Design Decisions</dt><dd><ul class="bullet-list">${decisions}</ul></dd></div>
              <div><dt>Reliability Considerations</dt><dd><ul class="bullet-list">${reliability}</ul></dd></div>
              <div><dt>What the project does</dt><dd><ul class="bullet-list">${results}</ul></dd></div>
            </dl>
            <div class="tech-group">
              <span class="tech-group-label">Technology stack</span>
              <ul class="badge-list">${stackBadges}</ul>
            </div>
          </div>
          ${diagram}
        </div>
        </details>
      </article>`;
    }).join('\n');

    const reposHtml = data.githubProjects.map((repo) => {
        const verification = data.githubProjectVerification?.[repo.name] || {};
        const ciStatus = escapeHtml(verification.ciStatus || 'Not verified');
        const ci = verification.ciUrl ? `<a href="${escapeHtml(verification.ciUrl)}">${ciStatus}</a>` : ciStatus;
        return `      <article class="repo-card" id="repo-${escapeHtml(repo.name)}">
        <div>
          ${renderProjectPreview(repo, prefix, true)}
          <div class="repo-top">
            <h4 class="repo-name"><a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a></h4>
            <span class="repo-lang">${escapeHtml(repo.language)}</span>
          </div>
          <p class="repo-desc">${escapeHtml(repo.description)}</p>
        </div>
        <div>
          <div class="repo-meta">
            <span>Concepts: ${escapeHtml(repo.topics.join(', '))}</span>
            <span>CI: ${ci}</span>
            ${verification.latestActivity ? `<span>Repository activity: ${escapeHtml(verification.latestActivity)}</span>` : ''}
            ${verification.verifiedAt ? `<span>Verified: ${escapeHtml(verification.verifiedAt)}</span>` : ''}
          </div>
          <div class="repo-links">
            <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">Repository</a>
            <a href="${escapeHtml(repo.docsUrl)}" target="_blank" rel="noopener noreferrer">Documentation</a>
            ${repo.testsUrl ? `<a href="${escapeHtml(repo.testsUrl)}">Tests</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('\n');

    return `<section id="projects" class="section section-alt" aria-labelledby="projects-heading">
  <div class="container">
    <div class="section-header">
      <h2 id="projects-heading" class="section-title">Case studies</h2>
    </div>
    <div class="case-grid">
${casesHtml}
    </div>
    <h3 class="repo-section-title">Selected GitHub Repositories</h3>
    <div class="repo-grid">
${reposHtml}
    </div>
  </div>
</section>`;
}

function renderArchitecture(data) {
    const tabsHtml = data.architectureDiagrams.map((d, idx) => `      <button type="button" class="arch-tab" role="tab" aria-selected="${idx === 0 ? 'true' : 'false'}" tabindex="${idx === 0 ? '0' : '-1'}" aria-controls="arch-panel-${escapeHtml(d.slug)}" id="arch-tab-${escapeHtml(d.slug)}" data-arch-tab="${escapeHtml(d.slug)}">${escapeHtml(d.tabTitle)}</button>`).join('\n');
    const staticDiagrams = data.architectureDiagrams.map((diagram) => `        <li><a href="../assets/images/projects/${escapeHtml(diagram.slug)}.svg">${escapeHtml(diagram.title)}</a></li>`).join('\n');

    const panelsHtml = data.architectureDiagrams.map((d, idx) => {
        const firstNode = d.nodes[0];
        const componentButtons = d.nodes.map((node, nodeIdx) => {
            const nodeJson = escapeHtml(JSON.stringify({
                title: node.title,
                responsibility: node.responsibility,
                concepts: node.concepts,
                tradeoffs: node.tradeoffs,
            }));
            return `          <li>
            <button type="button" class="arch-component-btn" data-node-id="${escapeHtml(node.id)}" data-node-json="${nodeJson}" aria-pressed="${nodeIdx === 0 ? 'true' : 'false'}">
              <strong>${nodeIdx + 1}. ${escapeHtml(node.title)}</strong>
              <span>${escapeHtml(node.responsibility)}</span>
            </button>
          </li>`;
        }).join('\n');

        return `    <div class="arch-panel" role="tabpanel" id="arch-panel-${escapeHtml(d.slug)}" aria-labelledby="arch-tab-${escapeHtml(d.slug)}" data-arch-panel="${escapeHtml(d.slug)}"${idx === 0 ? '' : ' hidden'}>
      <div class="arch-workspace">
        <div class="arch-svg-wrap">
          ${renderInteractiveSvg(d)}
        </div>
        <div class="arch-inspector">
          <div>
            <span class="case-scope case-scope-personal">${escapeHtml(d.originLabel)}</span>
            <h3>${escapeHtml(d.title)}</h3>
            <p class="section-lead">${escapeHtml(d.summary)}</p>
            ${renderProvenance(d.provenance)}
          </div>
          <div class="arch-inspector-box" data-inspector-detail>
            <p class="section-eyebrow">Selected Component</p>
            <h4 class="card-title" data-field="title">${escapeHtml(firstNode.title)}</h4>
            <p class="card-body" data-field="responsibility">${escapeHtml(firstNode.responsibility)}</p>
            <p class="tech-group-label" style="margin-top:0.75rem">Engineering Concepts</p>
            <p class="card-body" data-field="concepts">${escapeHtml(firstNode.concepts.join(' · '))}</p>
            <p class="tech-group-label" style="margin-top:0.75rem">Design Trade-off</p>
            <p class="card-body" data-field="tradeoffs">${escapeHtml(firstNode.tradeoffs)}</p>
          </div>
          <div>
            <p class="tech-group-label" style="margin-bottom:0.45rem">Inspect Components (Click or Enter)</p>
            <ul class="arch-component-list">
${componentButtons}
            </ul>
          </div>
        </div>
      </div>
    </div>`;
    }).join('\n');

    const conceptsHtml = data.engineeringConcepts.map((c) => `      <article class="concept-card">
        <h3>${escapeHtml(c.name)}</h3>
        <p>${escapeHtml(c.description)}</p>
      </article>`).join('\n');

    return `<section id="architecture" class="section" aria-labelledby="architecture-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Systems Design</p>
      <h2 id="architecture-heading" class="section-title">Interactive diagrams</h2>
    </div>
    <details class="recruitment-disclosure" id="static-diagrams">
      <summary>Open static diagrams</summary>
      <ul class="bullet-list">
${staticDiagrams}
      </ul>
    </details>
    <div class="arch-tabs" role="tablist" aria-label="Architecture diagrams">
${tabsHtml}
    </div>
${panelsHtml}
    <details class="recruitment-disclosure architecture-concepts">
      <summary>Engineering concepts</summary>
    <div class="concepts-grid">
${conceptsHtml}
    </div>
    </details>
  </div>
</section>`;
}

function renderSkills(data, depth) {
    const prefix = relPrefix(depth);
    const tierLabels = {
        core: 'Primary professional',
        additional: 'Additional professional',
        personal: 'Independent engineering',
        familiarity: 'Familiarity',
    };
    const roles = new Map(data.experience.map(({ id, company }) => [id, company]));
    const cases = new Map(data.caseStudies.map(({ id, title }) => [id, title]));
    const evidenceLink = ({ kind, ref }) => {
        if (kind === 'employment') return `<a href="${prefix}experience/#role-${escapeHtml(ref)}">${escapeHtml(roles.get(ref))}</a>`;
        if (kind === 'independent') return `<a href="${prefix}projects/#case-${escapeHtml(ref)}">${escapeHtml(cases.get(ref))}</a>`;
        if (kind === 'public-repository') return `<a href="${escapeHtml(ref)}">${escapeHtml(new URL(ref).pathname.split('/').at(-1))}</a>`;
        return 'Listed in the previous CV.';
    };

    const cardsHtml = data.skills.map((cat) => {
        const itemsHtml = cat.items.map((item) => {
            const cls = `tier-pill tier-${escapeHtml(item.tier)}`;
            const inner = item.techSlug
                ? `<a class="${cls}" href="${prefix}tech/${escapeHtml(item.techSlug)}.html">${escapeHtml(item.name)}</a>`
                : `<span class="${cls}">${escapeHtml(item.name)}</span>`;
            return `          <li data-tier="${escapeHtml(item.tier)}">${inner}</li>`;
        }).join('\n');
        const evidenceItems = cat.items.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> · ${item.evidence.map(evidenceLink).join(', ')}</li>`).join('');

        return `      <article class="skill-card">
        <h3>${escapeHtml(cat.title)}</h3>
        <p class="skill-card-desc">${escapeHtml(cat.description)}</p>
        <ul class="skill-items">
${itemsHtml}
        </ul>
        <details class="recruitment-disclosure">
          <summary>Skill evidence</summary>
          <ul class="bullet-list">${evidenceItems}</ul>
        </details>
      </article>`;
    }).join('\n');

    return `<section id="skills" class="section section-alt" aria-labelledby="skills-heading">
  <div class="container">
    <div class="section-header">
      <h2 id="skills-heading" class="section-title">Technical Skills &amp; Evidence</h2>
    </div>
    <div class="skills-toolbar">
      <div class="tier-legend" aria-label="Experience context legend">
        <span class="tier-pill tier-core">${tierLabels.core}</span>
        <span class="tier-pill tier-additional">${tierLabels.additional}</span>
        <span class="tier-pill tier-personal">${tierLabels.personal}</span>
        <span class="tier-pill tier-familiarity">${tierLabels.familiarity}</span>
      </div>
      <div class="skill-filter-group" role="group" aria-label="Filter skills by experience context">
        <button type="button" class="filter-btn" data-skill-filter="all" aria-pressed="true">All</button>
        <button type="button" class="filter-btn" data-skill-filter="core" aria-pressed="false">Core</button>
        <button type="button" class="filter-btn" data-skill-filter="additional" aria-pressed="false">Additional</button>
        <button type="button" class="filter-btn" data-skill-filter="personal" aria-pressed="false">Independent</button>
        <button type="button" class="filter-btn" data-skill-filter="familiarity" aria-pressed="false">Familiarity</button>
      </div>
    </div>
    <div class="skills-grid">
${cardsHtml}
    </div>
  </div>
</section>`;
}

function renderEducation(data) {
    const eduCards = data.education.map((e) => `      <article class="card">
        <h3 class="card-title">${escapeHtml(e.degree)}</h3>
        <p class="card-body">${escapeHtml(e.institution)}</p>
        <p class="role-period" style="margin-top:0.5rem">${escapeHtml(e.period)}</p>
      </article>`).join('\n');

    const langItems = data.languages.map((l) => `<li><strong>${escapeHtml(l.name)}:</strong> ${escapeHtml(l.level)}</li>`).join('');
    const interestItems = data.interests.map((i) => `<li><span class="badge">${escapeHtml(i)}</span></li>`).join('');

    return `<section id="education" class="section" aria-labelledby="education-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Academic Background</p>
      <h2 id="education-heading" class="section-title">Education, Languages &amp; Interests</h2>
    </div>
    <div class="edu-grid">
${eduCards}
      <article class="card">
        <h3 class="card-title">Languages</h3>
        <ul class="bullet-list">${langItems}</ul>
      </article>
      <article class="card">
        <h3 class="card-title">Interests</h3>
        <ul class="badge-list">${interestItems}</ul>
      </article>
    </div>
  </div>
</section>`;
}

function renderRecruiterExperience(data) {
    const roles = data.experience.filter((role) => !role.compact).map((role) => `    <article class="recruiter-role" id="role-${escapeHtml(role.id)}">
      <h3>${escapeHtml(role.company)}</h3>
      <p class="recruiter-meta">${escapeHtml(role.role)} · ${escapeHtml(role.period)} · ${escapeHtml(role.location)}</p>
      <p>${escapeHtml(role.summary)}</p>
      <ul class="bullet-list">
        ${role.responsibilities.slice(1, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </article>`).join('\n');

    return `<section id="experience" class="section section-alt recruiter-section" aria-labelledby="experience-heading">
  <div class="container">
    <h2 id="experience-heading" class="section-title">Professional experience</h2>
    <div class="recruiter-roles">
${roles}
    </div>
    <p class="recruiter-more"><a href="experience/">Full employment timeline</a> · <a id="education" href="experience/#education"><span id="education-heading">Education and languages</span></a></p>
  </div>
</section>`;
}

function renderRecruiterSkills(data, techLookup) {
    const coreNames = [
        'Java (6–25)', 'JVM & Concurrency', 'Spring Boot', 'Distributed Systems', 'Enterprise Integration',
        'RabbitMQ', 'SQL', 'PostgreSQL', 'Oracle Database', 'Jenkins', 'GitLab CI/CD', 'Docker / Compose', 'JUnit',
        'Kubernetes', 'Maven',
    ];
    const inventory = new Set(data.skills.flatMap(({ items }) => items.map(({ name }) => name)));
    const skills = coreNames.filter((name) => inventory.has(name));
    return `<section id="skills" class="section recruiter-section" aria-labelledby="skills-heading">
  <div class="container">
    <h2 id="skills-heading" class="section-title">Core technical skills</h2>
    <p class="section-lead">Backend development is my main focus, from JVM behaviour and message processing to relational persistence, automated testing and deployment.</p>
    <ul class="badge-list recruiter-skill-list">${renderTechChips(skills, techLookup)}</ul>
    <p class="recruiter-context">The detailed catalogue links these skills to specific roles and public projects. It also shows which technologies I use in independent work and which I have explored, so readers can assess the scope of each skill. The technology links above open shorter notes on individual tools.</p>
    <p class="recruiter-more"><a id="expertise" href="skills/#expertise-heading"><span id="expertise-heading">See the evidence behind each skill</span></a></p>
  </div>
</section>`;
}

function renderRecruiterProjects(data) {
    const repositories = new Map(data.githubProjects.map((repo) => [repo.name, repo]));
    const projects = [
        {
            id: 'entity-concurrency-locking',
            title: 'EntityLocker',
            text: 'A Java experiment in coordinating threads that share an entity key. Its public JUnit tests cover nested acquisition, reentrancy and timeouts. The case study looks at why retiring lock objects safely needs separate verification.',
            detail: 'Each instance has its own lock registry. The design notes distinguish locking within a Java process from coordination across processes.',
            scope: 'Java · JVM concurrency',
            href: 'projects/#case-entity-concurrency-locking',
            link: 'Read the locking case study',
            repo: repositories.get('EntityLocker'),
        },
        {
            id: 'messenger-archive-search',
            title: 'Message archive and semantic search',
            text: 'An independent Rust and Python project that transcribes audio and indexes messages for semantic search through MCP. The indexer writes to a stable vector ID before advancing its checkpoint so interrupted work can be replayed.',
            detail: 'PostgreSQL row locks let workers skip jobs that other workers have claimed. A repeated write updates the same vector, while other side effects need their own retry policy.',
            scope: 'Rust and Python · PostgreSQL and Qdrant',
            href: 'projects/#case-messenger-archive-search',
            link: 'Read the archive case study',
        },
        {
            id: 'funny-file-manager',
            title: 'FunnyFileManager',
            text: 'A Rust terminal file manager with two-panel navigation and keyboard controls for filesystem operations. The built-in editor supports language-server hover.',
            detail: 'The public repository includes behaviour tests for search and save in the editor, quick search and common file operations.',
            scope: 'Rust · Terminal interfaces and filesystem operations',
            href: 'projects/#repo-FunnyFileManager',
            link: 'View repository and tests',
            repo: repositories.get('FunnyFileManager'),
        },
        {
            id: 'rust-desktop-tooling',
            title: 'RustShot',
            text: 'A Rust screenshot utility for Windows, Linux and macOS. Platform adapters share output handling, and the capture guide documents the supported modes and destinations by operating system.',
            detail: 'On Wayland, the desktop portal handles full-desktop capture. Windows supports recording as a separate capture path.',
            scope: 'Rust · Desktop capture and platform adapters',
            href: 'projects/#case-rust-desktop-tooling',
            link: 'Read the desktop capture case study',
            repo: repositories.get('RustShot'),
        },
    ];
    const cards = projects.map(({ id, title, text, detail, scope, href, link, repo }) => `    <article class="recruiter-project" id="case-${escapeHtml(id)}">
      ${renderProjectPreview(repo)}
      <div class="recruiter-project-content">
        <h3>${escapeHtml(title)}</h3>
        <p class="recruiter-meta">${escapeHtml(scope)}</p>
        <p>${escapeHtml(text)}</p>
        <p>${escapeHtml(detail)}</p>
        <a href="${href}">${escapeHtml(link)}</a>
        ${repo ? ` · <a href="${escapeHtml(repo.url)}" aria-label="GitHub source for ${escapeHtml(title)}">GitHub source</a>` : ''}
      </div>
    </article>`).join('\n');

    const diagramLinks = data.architectureDiagrams.map((diagram) => `      <li id="arch-panel-${escapeHtml(diagram.slug)}"><a id="arch-tab-${escapeHtml(diagram.slug)}" href="architecture/#arch-tab-${escapeHtml(diagram.slug)}">${escapeHtml(diagram.tabTitle)}</a></li>`).join('\n');
    return `<section id="projects" class="section section-alt recruiter-section" aria-labelledby="projects-heading">
  <div class="container">
    <h2 id="projects-heading" class="section-title">Selected independent projects</h2>
    <div class="recruiter-projects">
${cards}
    </div>
    <p class="recruiter-more"><a href="projects/">All case studies and repositories</a> · <a id="architecture" href="architecture/"><span id="architecture-heading">Architecture portfolio</span></a></p>
    <details class="recruitment-disclosure">
      <summary>Individual diagrams</summary>
      <ul class="bullet-list">
${diagramLinks}
      </ul>
    </details>
  </div>
</section>`;
}

function renderContact(data) {
    const { contact, location } = data.profile;

    return `<section id="contact" class="section section-alt" aria-labelledby="contact-heading">
  <div class="container">
    <div class="contact-panel">
      <h2 id="contact-heading" class="section-title">Contact</h2>
      <p class="section-lead">${escapeHtml(location)} · <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></p>
      <div class="contact-actions">
        <button type="button" class="btn btn-secondary" data-copy-email="${escapeHtml(contact.email)}" data-status-target="copy-email-status">Copy Email Address</button>
        <a href="${escapeHtml(contact.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="${escapeHtml(contact.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="${escapeHtml(contact.telegram)}" target="_blank" rel="noopener noreferrer">Telegram</a>
        <a href="${escapeHtml(defaultCvHref(data))}" download>General CV PDF</a>
        <a href="cv/">All CV versions</a>
      </div>
      <p class="recruiter-context">The general edition is a two-page English CV with selectable text. The version index links both the web pages and the A4 downloads.</p>
      <p class="recruiter-context">For role-specific applications, see the <a href="cv/senior-java.html">Java backend</a>, <a href="cv/distributed-systems.html">distributed systems</a> and <a href="cv/fintech-integrations.html">integrations</a> editions. The <a href="cv/full.html">full CV</a> includes earlier roles and a broader project record.</p>
      <p id="copy-email-status" class="copy-status" aria-live="polite"></p>
    </div>
  </div>
</section>`;
}

function renderHomePage(data, techLookup) {
    const bodyHtml = [
        renderHero(data),
        renderRecruiterExperience(data),
        renderRecruiterSkills(data, techLookup),
        renderRecruiterProjects(data),
        renderContact(data),
    ].join('\n');

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Person',
                '@id': `${data.site.baseUrl}/#person`,
                name: data.profile.name,
                jobTitle: data.profile.title,
                description: data.profile.summary,
                url: `${data.site.baseUrl}/`,
                image: `${data.site.baseUrl}/${data.profile.photo}`,
                email: `mailto:${data.profile.contact.email}`,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Tallinn',
                    addressCountry: 'EE',
                },
                sameAs: [
                    data.profile.contact.github,
                    data.profile.contact.linkedin,
                    data.profile.contact.telegram,
                ],
                knowsAbout: data.profile.coreBadges,
            },
            {
                '@type': 'ProfilePage',
                '@id': `${data.site.baseUrl}/#profilepage`,
                url: `${data.site.baseUrl}/`,
                name: data.site.title,
                mainEntity: { '@id': `${data.site.baseUrl}/#person` },
            },
        ],
    };

    return renderDocument(data, {
        depth: 0,
        title: data.site.title,
        description: data.site.description,
        canonicalPath: '',
        ogType: 'profile',
        jsonLd,
        bodyHtml,
    });
}

function detailPageDefinition(data, route, techLookup) {
    switch (route) {
    case 'experience':
        return {
            title: 'Experience and education',
            description: 'Employment history, education and languages for Denis Stepulenok, a Senior Software Engineer in Tallinn.',
            body: renderExperience(data, techLookup, 1) + '\n' + renderEducation(data),
        };
    case 'skills':
        return {
            title: 'Skills and evidence',
            description: 'Java, distributed systems, independent engineering work and evidence for the technologies listed in the CV.',
            body: renderExpertise(data) + '\n' + renderSkills(data, 1),
        };
    case 'projects':
        return {
            title: 'Independent engineering projects',
            description: 'Case studies and public repositories in Java concurrency, semantic search and Rust desktop engineering.',
            body: renderProjects(data, 1),
            works: data.caseStudies.map((item) => ({ name: item.title, anchor: `case-${item.id}`, description: item.problem })),
        };
    case 'architecture':
        return {
            title: 'Architecture portfolio',
            description: 'Interactive diagrams for independent engineering projects and educational examples.',
            body: renderArchitecture(data),
            works: data.architectureDiagrams.map((item) => ({ name: item.title, anchor: `arch-tab-${item.slug}`, description: item.summary })),
        };
    default:
        throw new Error('Unknown portfolio detail page');
    }
}

function renderDetailPage(data, route, techLookup) {
    const { title, description, body, works } = detailPageDefinition(data, route, techLookup);
    const home = `${data.site.baseUrl}/`;
    const url = `${home}${route}/`;
    const author = { '@id': `${home}#person` };
    const breadcrumbs = {
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Portfolio', item: home },
            { '@type': 'ListItem', position: 2, name: title, item: url },
        ],
    };

    return renderDocument(data, {
        depth: 1,
        title: `${title} — ${data.profile.name}`,
        description,
        canonicalPath: `${route}/`,
        bodyHtml: `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html">Portfolio</a> / ${escapeHtml(title)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="section-lead">${escapeHtml(description)}</p>
  </div>
</section>
${body}`,
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [{
                '@type': 'CollectionPage',
                '@id': `${url}#page`,
                url,
                name: title,
                description,
                author,
                ...(works ? {
                    hasPart: works.map(({ name, anchor, description: workDescription }) => ({
                        '@type': 'CreativeWork',
                        url: `${url}#${anchor}`,
                        name,
                        description: workDescription,
                        author,
                    })),
                } : {}),
            }, breadcrumbs],
        },
    });
}

function renderCvIndexPage(data) {
    const cards = data.variants.map((v) => `      <article class="card">
        <p class="section-eyebrow">${escapeHtml(v.shortLabel)}</p>
        <h2 class="card-title">${escapeHtml(v.roleTitle)}</h2>
        <p class="card-body">${escapeHtml(v.summary)}</p>
        <div class="hero-actions" style="margin-top:1rem;margin-bottom:0">
          <a class="btn btn-secondary btn-sm" href="${escapeHtml(v.slug)}.html">Open Web CV</a>
          <a class="btn btn-primary btn-sm" href="../assets/pdf/${escapeHtml(v.pdfFilename)}" download>Download PDF</a>
        </div>
      </article>`).join('\n');

    const bodyHtml = `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html">&larr; Back to Main Portfolio</a></p>
    <h1>CV Versions</h1>
    <p class="section-lead">General, role-specific and full CVs, available as web pages and ATS-friendly A4 PDFs.</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="repo-grid">
${cards}
    </div>
  </div>
</section>`;

    return renderDocument(data, {
        depth: 1,
        title: `CV Versions — ${data.profile.name}`,
        description: 'General, Senior Java, Distributed Systems, Fintech, Wise, AI/MCP, and Full CV web and PDF versions for Denis Stepulenok.',
        canonicalPath: 'cv/index.html',
        bodyHtml,
    });
}

function renderVariantPage(data, variant, techLookup) {
    const skillById = new Map(data.skills.map((s) => [s.id, s]));
    const caseById = new Map(data.caseStudies.map((c) => [c.id, c]));
    const repoByName = new Map(data.githubProjects.map((r) => [r.name, r]));

    const roles = variant.includeCompactRoles
        ? data.experience
        : data.experience.filter((r) => !r.compact);

    const highlights = variant.focusHighlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
    const selectedSkills = variant.skillNames && new Set(variant.skillNames);

    const skillsHtml = variant.skillCategoryOrder
        .map((id) => skillById.get(id))
        .filter(Boolean)
        .map((cat) => {
            const items = selectedSkills ? cat.items.filter(({ name }) => selectedSkills.has(name)) : cat.items;
            if (!items.length) return '';
            const pills = items.map((item) => {
                const cls = `tier-pill tier-${escapeHtml(item.tier)}`;
                return item.techSlug
                    ? `<li><a class="${cls}" href="../tech/${escapeHtml(item.techSlug)}.html">${escapeHtml(item.name)}</a></li>`
                    : `<li><span class="${cls}">${escapeHtml(item.name)}</span></li>`;
            }).join('');
            return `      <article class="skill-card">
        <h3>${escapeHtml(cat.title)}</h3>
        <ul class="skill-items">${pills}</ul>
      </article>`;
        }).join('\n');

    const rolesHtml = roles.map((role) => {
        const bullets = role.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
        return `      <article class="role-card">
        <div class="role-header">
          <h3 class="role-title">${escapeHtml(role.role)} — ${escapeHtml(role.company)}</h3>
          <span class="role-period">${escapeHtml(role.period)}</span>
        </div>
        <p class="role-company">${escapeHtml(role.location)}${role.companyNote ? ` · ${escapeHtml(role.companyNote)}` : ''}</p>
        <p class="role-summary">${escapeHtml(role.summary)}</p>
        <ul class="bullet-list">${bullets}</ul>
        <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, 1)}</ul>
      </article>`;
    }).join('\n');

    const casesHtml = variant.caseStudyIds
        .map((id) => caseById.get(id))
        .filter(Boolean)
        .map((cs) => `      <article class="card">
        <span class="${cs.scopeType === 'personal' ? 'case-scope case-scope-personal' : 'case-scope'}">${escapeHtml(cs.scope)}</span>
        <h3 class="card-title">${escapeHtml(cs.title)}</h3>
        <p class="card-body"><strong>Problem:</strong> ${escapeHtml(cs.problem)}</p>
        <p class="card-body" style="margin-top:0.5rem"><strong>Architecture:</strong> ${escapeHtml(cs.architecture)}</p>
        <p class="card-body" style="margin-top:0.5rem"><strong>Stack:</strong> ${escapeHtml(cs.stack.join(', '))}</p>
      </article>`).join('\n');

    const reposHtml = variant.githubProjectNames
        .map((name) => repoByName.get(name))
        .filter(Boolean)
        .map((repo) => `      <article class="card">
        <h3 class="card-title"><a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a> (${escapeHtml(repo.language)})</h3>
        <p class="card-body">${escapeHtml(repo.description)}</p>
      </article>`).join('\n');

    const otherVariants = data.variants
        .filter((v) => v.slug !== variant.slug)
        .map((v) => `<li><a class="badge" href="${escapeHtml(v.slug)}.html">${escapeHtml(v.shortLabel)}</a></li>`)
        .join('');

    const pdfPath = `../assets/pdf/${variant.pdfFilename}`;

    const bodyHtml = `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html">&larr; Back to Portfolio</a> &middot; <a href="index.html">All CV Versions</a></p>
    <p class="section-eyebrow">${escapeHtml(variant.shortLabel)} &middot; ${escapeHtml(data.profile.location)}</p>
    <h1>${escapeHtml(data.profile.name)} — ${escapeHtml(variant.roleTitle)}</h1>
    <p class="section-lead">${escapeHtml(variant.summary)}</p>
    <div class="hero-actions" style="margin-top:1.25rem">
      <a class="btn btn-primary" href="${escapeHtml(pdfPath)}" download>Download ATS PDF (${escapeHtml(variant.pdfFilename)})</a>
      <a class="btn btn-secondary" href="mailto:${escapeHtml(data.profile.contact.email)}">Send Email</a>
      <button type="button" class="btn btn-secondary" data-copy-email="${escapeHtml(data.profile.contact.email)}" data-status-target="variant-copy-status">Copy Email Address</button>
    </div>
    <p id="variant-copy-status" class="copy-status" aria-live="polite"></p>
    <ul class="bullet-list" style="margin-top:1rem">${highlights}</ul>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2>Prioritised Skills</h2>
    <div class="skills-grid">
${skillsHtml}
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2>Professional Experience</h2>
    <div class="timeline">
${rolesHtml}
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <h2>Selected Projects</h2>
    <div class="case-grid">
${casesHtml}
    </div>
    <h3 style="margin-top:1.75rem">Selected Public Repositories</h3>
    <div class="repo-grid">
${reposHtml}
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2>Other Targeted CV Versions</h2>
    <ul class="badge-list">${otherVariants}</ul>
  </div>
</section>`;

    return renderDocument(data, {
        depth: 1,
        title: `${data.profile.name} — ${variant.roleTitle}`,
        description: variant.summary,
        canonicalPath: `cv/${variant.slug}.html`,
        downloadHref: pdfPath,
        bodyHtml,
    });
}

function renderOgSvg(data) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b1120"/>
  <rect x="48" y="48" width="1104" height="534" rx="18" fill="#111827" stroke="#1e293b" stroke-width="2"/>
  <rect x="48" y="48" width="12" height="534" rx="6" fill="#2dd4bf"/>
  <text x="102" y="130" fill="#5eead4" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="700" letter-spacing="2">SENIOR SOFTWARE ENGINEER PORTFOLIO</text>
  <text x="102" y="218" fill="#f1f5f9" font-family="Inter, system-ui, sans-serif" font-size="60" font-weight="800">${escapeXml(data.profile.name)}</text>
  <text x="102" y="280" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="600">${escapeXml(data.profile.title)}</text>
  <text x="102" y="346" fill="#94a3b8" font-family="Inter, system-ui, sans-serif" font-size="25" font-weight="400">Tallinn, Estonia · Kuehne+Nagel · Bolt (Taxify) · Oracle</text>
  <text x="102" y="438" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="500">Java (6–25) · Spring Boot · RabbitMQ · PostgreSQL · Docker · Kubernetes · Rust · MCP</text>
  <text x="102" y="520" fill="#5eead4" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600">https://stden.github.io/CV/</text>
</svg>
`;
}

function writeDiscoveryFiles(data) {
    const base = data.site.baseUrl;
    const urls = [
        `${base}/`,
        `${base}/cv/index.html`,
        ...DETAIL_PAGES.map((route) => `${base}/${route}/`),
        ...data.variants.map((v) => `${base}/cv/${v.slug}.html`),
        ...data.technologies.map((t) => `${base}/tech/${t.slug}.html`),
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n')}
</urlset>
`;
    const robots = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;

    fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemap);
    fs.writeFileSync(path.join(ROOT_DIR, 'robots.txt'), robots);
}

function main() {
    const data = loadCvData();
    const techLookup = buildTechSlugLookup(data);

    copyFonts();

    fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), renderHomePage(data, techLookup));

    for (const route of DETAIL_PAGES) {
        const directory = path.join(ROOT_DIR, route);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'index.html'), renderDetailPage(data, route, techLookup));
    }

    const cvDir = path.join(ROOT_DIR, 'cv');
    fs.mkdirSync(cvDir, { recursive: true });
    fs.writeFileSync(path.join(cvDir, 'index.html'), renderCvIndexPage(data));
    for (const variant of data.variants) {
        fs.writeFileSync(
            path.join(cvDir, `${variant.slug}.html`),
            renderVariantPage(data, variant, techLookup)
        );
    }

    fs.writeFileSync(
        path.join(ROOT_DIR, 'assets', 'images', 'og-preview.svg'),
        renderOgSvg(data)
    );

    writeDiscoveryFiles(data);
    console.log(`Built index.html, cv/index.html, ${data.variants.length} CV variant pages, sitemap.xml, robots.txt`);
}

if (require.main === module) {
    main();
}
