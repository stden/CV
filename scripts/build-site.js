const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, escapeXml, loadCvData, relPrefix } = require('./lib/utils');
const { renderDocument } = require('./lib/layout');
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

    const badges = profile.coreBadges
        .map((b) => `<li><span class="badge">${escapeHtml(b)}</span></li>`)
        .join('');

    return `<section id="overview" class="hero">
  <div class="container hero-grid">
    <div>
      <p class="hero-location">${escapeHtml(profile.location)}</p>
      <h1 class="hero-name">${escapeHtml(profile.name)}</h1>
      <p class="hero-role">${escapeHtml(profile.title)}</p>${availabilityHtml}
      <p class="hero-summary">${escapeHtml(profile.summary)}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="assets/pdf/Denis-Stepulenok-Senior-Java-Engineer.pdf" download>Download CV (PDF)</a>
        <a class="btn btn-secondary" href="#contact">Contact</a>
        <a class="btn btn-ghost" href="${escapeHtml(profile.contact.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a class="btn btn-ghost" href="${escapeHtml(profile.contact.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a class="btn btn-ghost" href="cv/index.html">Targeted CVs</a>
      </div>
      <ul class="badge-list" aria-label="Core technologies">
        ${badges}
      </ul>
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

function renderExperience(data, techLookup) {
    const primary = data.experience.filter((r) => !r.compact);
    const earlier = data.experience.filter((r) => r.compact);

    const primaryHtml = primary.map((role) => {
        const companyLabel = role.url
            ? `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(role.company)}</a>`
            : escapeHtml(role.company);
        const note = role.companyNote ? ` &middot; ${escapeHtml(role.companyNote)}` : '';
        const bullets = role.responsibilities.map((r) => `          <li>${escapeHtml(r)}</li>`).join('\n');
        const additionalBlock = role.additionalTechnologies?.length
            ? `<div class="tech-group">
            <span class="tech-group-label">Additional role technologies</span>
            <ul class="badge-list">${renderTechChips(role.additionalTechnologies, techLookup, 0)}</ul>
          </div>`
            : '';

        return `      <article class="role-card">
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
          <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, 0)}</ul>
        </div>
        ${additionalBlock}
      </article>`;
    }).join('\n');

    const earlierHtml = earlier.map((role) => {
        const companyText = role.url
            ? `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(role.company)}</a>`
            : escapeHtml(role.company);
        const bullets = role.responsibilities.map((r) => `            <li>${escapeHtml(r)}</li>`).join('\n');
        return `        <details class="compact-role">
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
            <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, 0)}</ul>
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

function renderProjects(data) {
    const casesHtml = data.caseStudies.map((cs) => {
        const scopeClass = cs.scopeType === 'personal' ? 'case-scope case-scope-personal' : 'case-scope';
        const stackBadges = cs.stack.map((s) => `<li><span class="badge">${escapeHtml(s)}</span></li>`).join('');
        const challenges = cs.challenges.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
        const decisions = cs.decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
        const reliability = cs.reliability.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
        const results = cs.results.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

        return `      <article class="case-card">
        <span class="${scopeClass}">${escapeHtml(cs.scope)}</span>
        <h3 class="case-title">${escapeHtml(cs.title)}</h3>
        <div class="case-columns">
          <div>
            <dl class="case-dl">
              <div><dt>Problem Statement</dt><dd>${escapeHtml(cs.problem)}</dd></div>
              <div><dt>Engineering Context</dt><dd>${escapeHtml(cs.context)}</dd></div>
              <div><dt>Architecture</dt><dd>${escapeHtml(cs.architecture)}</dd></div>
              <div><dt>Technical Challenges</dt><dd><ul class="bullet-list">${challenges}</ul></dd></div>
              <div><dt>Design Decisions</dt><dd><ul class="bullet-list">${decisions}</ul></dd></div>
              <div><dt>Reliability Considerations</dt><dd><ul class="bullet-list">${reliability}</ul></dd></div>
              <div><dt>Verified Outcomes</dt><dd><ul class="bullet-list">${results}</ul></dd></div>
            </dl>
            <div class="tech-group">
              <span class="tech-group-label">Technology stack</span>
              <ul class="badge-list">${stackBadges}</ul>
            </div>
          </div>
          <div class="case-diagram-box">
            <img src="assets/images/projects/${escapeHtml(cs.diagramSlug)}.svg" alt="${escapeHtml(cs.title)} architecture flow diagram" loading="lazy" width="420" height="580">
            <p class="case-diagram-caption"><a href="#architecture">Inspect interactive component breakdown &rarr;</a></p>
          </div>
        </div>
      </article>`;
    }).join('\n');

    const reposHtml = data.githubProjects.map((repo) => {
        const allLangs = [repo.language, ...(repo.secondaryLanguages || [])].join(' · ');
        return `      <article class="repo-card">
        <div>
          <div class="repo-top">
            <h4 class="repo-name"><a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a></h4>
            <span class="repo-lang">${escapeHtml(repo.language)}</span>
          </div>
          <p class="repo-desc">${escapeHtml(repo.description)}</p>
        </div>
        <div>
          <div class="repo-meta">
            <span>Stack: ${escapeHtml(allLangs)}</span>
            <span>CI: ${escapeHtml(repo.ciStatus)}</span>
            <span>Updated: ${escapeHtml(repo.latestActivity)}</span>
          </div>
          <div class="repo-links">
            <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">Repository</a>
            <a href="${escapeHtml(repo.docsUrl)}" target="_blank" rel="noopener noreferrer">Documentation</a>
          </div>
        </div>
      </article>`;
    }).join('\n');

    return `<section id="projects" class="section section-alt" aria-labelledby="projects-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Engineering Case Studies</p>
      <h2 id="projects-heading" class="section-title">Selected Projects &amp; Open Source</h2>
      <p class="section-lead">Production architecture case studies alongside public repositories spanning Java, Rust, Python, and AI tooling.</p>
    </div>
    <div class="case-grid">
${casesHtml}
    </div>
    <h3 class="repo-section-title">Selected Public GitHub Repositories</h3>
    <p class="repo-section-lead">Verified public repositories from <a href="${escapeHtml(data.profile.contact.github)}" target="_blank" rel="noopener noreferrer">github.com/stden</a> highlighting Rust, Java concurrency, JPA, quality automation, and MCP/AI tooling.</p>
    <div class="repo-grid">
${reposHtml}
    </div>
  </div>
</section>`;
}

function renderArchitecture(data) {
    const tabsHtml = data.architectureDiagrams.map((d, idx) => `      <button type="button" class="arch-tab" role="tab" aria-selected="${idx === 0 ? 'true' : 'false'}" aria-controls="arch-panel-${escapeHtml(d.slug)}" id="arch-tab-${escapeHtml(d.slug)}" data-arch-tab="${escapeHtml(d.slug)}">${escapeHtml(d.tabTitle)}</button>`).join('\n');

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
            <h3>${escapeHtml(d.title)}</h3>
            <p class="section-lead">${escapeHtml(d.summary)}</p>
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
      <h2 id="architecture-heading" class="section-title">Architecture Portfolio</h2>
      <p class="section-lead">Interactive component flows illustrating asynchronous messaging, stateless security tokens, distributed lifecycle coordination, and semantic search with MCP.</p>
    </div>
    <div class="arch-tabs" role="tablist" aria-label="Architecture diagrams">
${tabsHtml}
    </div>
${panelsHtml}
    <div class="concepts-grid" aria-label="Engineering concepts">
${conceptsHtml}
    </div>
  </div>
</section>`;
}

function renderSkills(data) {
    const tierLabels = {
        core: 'Core professional',
        additional: 'Additional professional',
        personal: 'Personal / independent',
    };

    const cardsHtml = data.skills.map((cat) => {
        const itemsHtml = cat.items.map((item) => {
            const cls = `tier-pill tier-${escapeHtml(item.tier)}`;
            const inner = item.techSlug
                ? `<a class="${cls}" href="tech/${escapeHtml(item.techSlug)}.html">${escapeHtml(item.name)}</a>`
                : `<span class="${cls}">${escapeHtml(item.name)}</span>`;
            return `          <li data-tier="${escapeHtml(item.tier)}">${inner}</li>`;
        }).join('\n');

        return `      <article class="skill-card">
        <h3>${escapeHtml(cat.title)}</h3>
        <p class="skill-card-desc">${escapeHtml(cat.description)}</p>
        <ul class="skill-items">
${itemsHtml}
        </ul>
      </article>`;
    }).join('\n');

    return `<section id="skills" class="section section-alt" aria-labelledby="skills-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">Technical Matrix</p>
      <h2 id="skills-heading" class="section-title">Technical Skills &amp; Evidence</h2>
      <p class="section-lead">Categorised by engineering domain and backed by role or repository evidence—distinguishing core production skills from additional and personal project technologies.</p>
    </div>
    <div class="skills-toolbar">
      <div class="tier-legend" aria-label="Experience context legend">
        <span class="tier-pill tier-core">${tierLabels.core}</span>
        <span class="tier-pill tier-additional">${tierLabels.additional}</span>
        <span class="tier-pill tier-personal">${tierLabels.personal}</span>
      </div>
      <div class="skill-filter-group" role="group" aria-label="Filter skills by experience context">
        <button type="button" class="filter-btn" data-skill-filter="all" aria-pressed="true">All</button>
        <button type="button" class="filter-btn" data-skill-filter="core" aria-pressed="false">Core</button>
        <button type="button" class="filter-btn" data-skill-filter="additional" aria-pressed="false">Additional</button>
        <button type="button" class="filter-btn" data-skill-filter="personal" aria-pressed="false">Personal</button>
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

function renderContact(data) {
    const { contact } = data.profile;
    const variantCards = data.variants.map((v) => `      <article class="variant-card">
        <div>
          <h3>${escapeHtml(v.shortLabel)}</h3>
          <p>${escapeHtml(v.targetAudience)}</p>
        </div>
        <div class="variant-actions">
          <a class="btn btn-secondary btn-sm" href="cv/${escapeHtml(v.slug)}.html">View CV</a>
          <a class="btn btn-primary btn-sm" href="assets/pdf/${escapeHtml(v.pdfFilename)}" download>PDF</a>
        </div>
      </article>`).join('\n');

    return `<section id="contact" class="section section-alt" aria-labelledby="contact-heading">
  <div class="container">
    <div class="contact-panel">
      <p class="section-eyebrow">Recruiter &amp; Hiring Contact</p>
      <h2 id="contact-heading" class="section-title">Get in Touch &amp; Download Targeted CVs</h2>
      <p class="section-lead">Based in ${escapeHtml(data.profile.location)}. Direct contact channels and role-specific ATS-friendly PDF resumes generated from a single verified profile.</p>
      <div class="contact-actions">
        <a class="btn btn-primary" href="assets/pdf/Denis-Stepulenok-Senior-Java-Engineer.pdf" download>Download Senior Java CV</a>
        <a class="btn btn-secondary" href="mailto:${escapeHtml(contact.email)}">Send Email</a>
        <button type="button" class="btn btn-secondary" data-copy-email="${escapeHtml(contact.email)}" data-status-target="copy-email-status">Copy Email Address</button>
        <a class="btn btn-ghost" href="${escapeHtml(contact.linkedin)}" target="_blank" rel="noopener noreferrer">View LinkedIn</a>
        <a class="btn btn-ghost" href="${escapeHtml(contact.github)}" target="_blank" rel="noopener noreferrer">View GitHub</a>
        <a class="btn btn-ghost" href="${escapeHtml(contact.telegram)}" target="_blank" rel="noopener noreferrer">Telegram (${escapeHtml(contact.telegramHandle)})</a>
      </div>
      <p id="copy-email-status" class="copy-status" aria-live="polite"></p>
    </div>
    <div class="variants-grid" aria-label="Targeted CV versions">
${variantCards}
    </div>
  </div>
</section>`;
}

function renderHomePage(data, techLookup) {
    const bodyHtml = [
        renderHero(data),
        renderExpertise(data),
        renderExperience(data, techLookup),
        renderProjects(data),
        renderArchitecture(data),
        renderSkills(data),
        renderEducation(data),
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
                knowsAbout: [
                    'Java',
                    'Spring Boot',
                    'Distributed Systems',
                    'RabbitMQ',
                    'Apache Kafka',
                    'PostgreSQL',
                    'Oracle Database',
                    'Docker',
                    'Kubernetes',
                    'Python',
                    'Rust',
                    'Model Context Protocol',
                ],
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
        downloadHref: 'assets/pdf/Denis-Stepulenok-Senior-Java-Engineer.pdf',
        bodyHtml,
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
    <h1>Targeted CV Versions</h1>
    <p class="section-lead">Role-specific web and ATS-friendly A4 PDF resumes generated from a single verified source of truth (${escapeHtml(data.profile.name)}).</p>
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
        title: `Targeted CV Versions — ${data.profile.name}`,
        description: 'Role-specific Senior Java, Distributed Systems, Fintech, Wise, AI/MCP, and Full CV web and PDF versions for Denis Stepulenok.',
        canonicalPath: 'cv/index.html',
        downloadHref: '../assets/pdf/Denis-Stepulenok-Full-CV.pdf',
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

    const skillsHtml = variant.skillCategoryOrder
        .map((id) => skillById.get(id))
        .filter(Boolean)
        .map((cat) => {
            const pills = cat.items.map((item) => {
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
