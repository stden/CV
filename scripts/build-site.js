const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeHtml, escapeXml, loadCvData, relPrefix } = require('./lib/utils');
const { defaultCvHref, renderDocument } = require('./lib/layout');
const { LOCALES, setLocale, ui, validateLocales, localizeData, pageOutputPath, isTranslatedPage, currentLocaleCode } = require('./lib/i18n');
const { renderInteractiveSvg } = require('./build-project-diagrams');

// Inter subsets: Latin (English, German), Latin Extended (Estonian Š and Ž), Cyrillic (Russian).
const FONT_SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'];

function copyFonts() {
    const srcDir = path.join(ROOT_DIR, 'node_modules', '@fontsource-variable', 'inter', 'files');
    const dstDir = path.join(ROOT_DIR, 'assets', 'fonts');
    fs.mkdirSync(dstDir, { recursive: true });
    for (const subset of FONT_SUBSETS) {
        const name = `inter-${subset}-wght-normal.woff2`;
        fs.copyFileSync(path.join(srcDir, name), path.join(dstDir, name));
    }
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
      <p class="hero-intro">${escapeHtml(profile.homeIntro)}</p>
      <p class="hero-languages">${escapeHtml(ui('heroLanguages'))}: ${data.languages.map((l) => `${escapeHtml(l.name)} (${escapeHtml(l.level)})`).join(', ')}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="${escapeHtml(defaultCvHref(data, localeDepth()))}" download>${escapeHtml(ui('downloadCvPdf'))}</a>
        <a class="btn btn-ghost" href="${escapeHtml(profile.contact.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a class="btn btn-ghost" href="${escapeHtml(profile.contact.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </div>
      <ul class="badge-list" aria-label="${escapeHtml(ui('heroBadgesLabel'))}">
        ${badges}
      </ul>
    </div>
    <div class="hero-photo-wrap">
      <img class="hero-photo" src="${relPrefix(localeDepth())}${escapeHtml(profile.photo)}" alt="${escapeHtml(profile.photoAlt)}" width="${profile.photoWidth}" height="${profile.photoHeight}" decoding="async">
    </div>
  </div>
</section>`;
}

function renderExperience(data, techLookup, depth = 0) {
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
            <span class="tech-group-label">${escapeHtml(ui('additionalTechLabel'))}</span>
            <ul class="badge-list">${renderTechChips(role.additionalTechnologies, techLookup, depth)}</ul>
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
          <span class="tech-group-label">${escapeHtml(ui('primaryTechLabel'))}</span>
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
            <ul class="badge-list">${renderTechChips(role.projectTechnologies, techLookup, depth)}</ul>
          </div>
        </details>`;
    }).join('\n');

    return `<section id="experience" class="section" aria-labelledby="experience-heading">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">${escapeHtml(ui('careerTimeline'))}</p>
      <h2 id="experience-heading" class="section-title">${escapeHtml(ui('experienceTitle'))}</h2>
      <p class="section-lead">${escapeHtml(ui('experienceFullLead'))}</p>
    </div>
    <div class="timeline">
${primaryHtml}
    </div>
    <div class="earlier-roles">
      <h3 class="earlier-roles-heading">${escapeHtml(ui('earlierRolesHeading'))}</h3>
      <div class="earlier-list">
${earlierHtml}
      </div>
    </div>
  </div>
</section>`;
}

function renderProjects(data, depth = 0) {
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
              <div><dt>${escapeHtml(ui('caseProblem'))}</dt><dd>${escapeHtml(cs.problem)}</dd></div>
              <div><dt>Engineering Context</dt><dd>${escapeHtml(cs.context)}</dd></div>
              <div><dt>Architecture</dt><dd>${escapeHtml(cs.architecture)}</dd></div>
              <div><dt>${escapeHtml(ui('caseChallenges'))}</dt><dd><ul class="bullet-list">${challenges}</ul></dd></div>
              <div><dt>${escapeHtml(ui('caseDecisions'))}</dt><dd><ul class="bullet-list">${decisions}</ul></dd></div>
              <div><dt>${escapeHtml(ui('caseReliability'))}</dt><dd><ul class="bullet-list">${reliability}</ul></dd></div>
              <div><dt>${escapeHtml(ui('caseOutcomes'))}</dt><dd><ul class="bullet-list">${results}</ul></dd></div>
            </dl>
            <div class="tech-group">
              <span class="tech-group-label">${escapeHtml(ui('caseStack'))}</span>
              <ul class="badge-list">${stackBadges}</ul>
            </div>
          </div>
          ${cs.diagramSlug ? `<div class="case-diagram-box">
            <img src="${relPrefix(depth)}assets/images/projects/${escapeHtml(cs.diagramSlug)}.svg" alt="${escapeHtml(cs.title)} architecture flow diagram" loading="lazy" width="420" height="580">
            <p class="case-diagram-caption"><a href="${relPrefix(depth)}architecture/index.html">${escapeHtml(ui('caseInspect'))} &rarr;</a></p>
          </div>` : ''}
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
      <p class="section-eyebrow">${escapeHtml(ui('projectsEyebrow'))}</p>
      <h2 id="projects-heading" class="section-title">${escapeHtml(ui('projectsSectionTitle'))}</h2>
      <p class="section-lead">${escapeHtml(ui('projectsSectionLead'))}</p>
    </div>
    <div class="case-grid">
${casesHtml}
    </div>
    <h3 class="repo-section-title">${escapeHtml(ui('repoSectionTitle'))}</h3>
    <p class="repo-section-lead">Verified public repositories from <a href="${escapeHtml(data.profile.contact.github)}" target="_blank" rel="noopener noreferrer">github.com/stden</a> highlighting Rust, Java concurrency, JPA, quality automation, and MCP/AI tooling.</p>
    <div class="repo-grid">
${reposHtml}
    </div>
  </div>
</section>`;
}

function renderArchitecture(data, depth = 0) {
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
            <span class="case-scope case-scope-personal">${escapeHtml(d.originLabel)}</span>
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
      <p class="section-lead">Interactive component flows based exclusively on independent personal projects, open-source software, and educational reference architectures—unrelated to any employer systems.</p>
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

function renderSkills(data, depth = 0) {
    const tierLabels = {
        core: 'Core professional',
        additional: 'Additional professional',
        personal: 'Personal / independent',
    };

    const cardsHtml = data.skills.map((cat) => {
        const itemsHtml = cat.items.map((item) => {
            const cls = `tier-pill tier-${escapeHtml(item.tier)}`;
            const inner = item.techSlug
                ? `<a class="${cls}" href="${relPrefix(depth)}tech/${escapeHtml(item.techSlug)}.html">${escapeHtml(item.name)}</a>`
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
      <p class="section-eyebrow">${escapeHtml(ui('skillsEyebrow'))}</p>
      <h2 id="skills-heading" class="section-title">${escapeHtml(ui('skillsSectionTitle'))}</h2>
      <p class="section-lead">${escapeHtml(ui('skillsSectionLead'))}</p>
    </div>
    <div class="skills-toolbar">
      <div class="tier-legend" aria-label="${escapeHtml(ui('legendLabel'))}">
        <span class="tier-pill tier-core">${tierLabels.core}</span>
        <span class="tier-pill tier-additional">${tierLabels.additional}</span>
        <span class="tier-pill tier-personal">${tierLabels.personal}</span>
      </div>
      <div class="skill-filter-group" role="group" aria-label="${escapeHtml(ui('filterLabel'))}">
        <button type="button" class="filter-btn" data-skill-filter="all" aria-pressed="true">${escapeHtml(ui('filterAll'))}</button>
        <button type="button" class="filter-btn" data-skill-filter="core" aria-pressed="false">${escapeHtml(ui('filterCore'))}</button>
        <button type="button" class="filter-btn" data-skill-filter="additional" aria-pressed="false">${escapeHtml(ui('filterAdditional'))}</button>
        <button type="button" class="filter-btn" data-skill-filter="personal" aria-pressed="false">${escapeHtml(ui('filterPersonal'))}</button>
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
      <p class="section-eyebrow">${escapeHtml(ui('educationEyebrow'))}</p>
      <h2 id="education-heading" class="section-title">${escapeHtml(ui('educationTitle'))}</h2>
    </div>
    <div class="edu-grid">
${eduCards}
      <article class="card">
        <h3 class="card-title">${escapeHtml(ui('languagesLabel'))}</h3>
        <ul class="bullet-list">${langItems}</ul>
      </article>
      <article class="card">
        <h3 class="card-title">${escapeHtml(ui('interestsLabel'))}</h3>
        <ul class="badge-list">${interestItems}</ul>
      </article>
    </div>
  </div>
</section>`;
}

const HOME_EXPERIENCE_IDS = ['kuehne-nagel', 'taxify-bolt', 'oracle'];

function localeDepth() {
    return currentLocaleCode() === 'en' ? 0 : 1;
}

function renderHomeExperience(data) {
    const roles = HOME_EXPERIENCE_IDS.map((id) => data.experience.find((r) => r.id === id)).filter(Boolean);
    const items = roles.map((role) => {
        const companyLabel = role.url
            ? `<a href="${escapeHtml(role.url)}" rel="noopener noreferrer">${escapeHtml(role.company)}</a>`
            : escapeHtml(role.company);
        const bullets = role.homeBullets.map((b) => `          <li>${escapeHtml(b)}</li>`).join('\n');
        return `      <article class="home-role">
        <div class="role-header">
          <h3 class="role-title">${escapeHtml(role.role)}</h3>
          <span class="role-period">${escapeHtml(role.period)}</span>
        </div>
        <p class="role-company">${companyLabel} &middot; ${escapeHtml(role.location)}</p>
        <p class="role-summary">${escapeHtml(role.homeSummary)}</p>
        <ul class="bullet-list">
${bullets}
        </ul>
        <p class="tech-list"><strong>${escapeHtml(ui('technologiesLabel'))}</strong> ${role.projectTechnologies.slice(0, 8).map(escapeHtml).join(', ')}</p>
      </article>`;
    }).join('\n');

    return `<section id="experience" class="section" aria-labelledby="experience-heading">
  <div class="container">
    <h2 id="experience-heading" class="section-title">${escapeHtml(ui('experienceTitle'))}</h2>
    <p class="section-lead">${escapeHtml(ui('experienceLead'))}</p>
    <div class="home-roles">
${items}
    </div>
    <p class="section-more"><a class="btn btn-ghost btn-sm" href="experience/index.html">${escapeHtml(ui('fullHistory'))}</a></p>
  </div>
</section>`;
}

function renderHomeSkills(data) {
    const groups = data.profile.coreSkillGroups.map((group) => `      <div class="skill-group-home">
        <h3 class="skill-group-title">${escapeHtml(group.title)}</h3>
        <p class="muted">${escapeHtml(group.description)}</p>
        <ul class="badge-list" aria-label="${escapeHtml(group.title)} skills">${group.items.map((s) => `<li><span class="badge">${escapeHtml(s)}</span></li>`).join('')}</ul>
      </div>`).join('\n');
    return `<section id="skills" class="section section-alt" aria-labelledby="skills-heading">
  <div class="container">
    <h2 id="skills-heading" class="section-title">${escapeHtml(ui('skillsTitle'))}</h2>
    <p class="section-lead">${escapeHtml(ui('skillsLead'))}</p>
${groups}
    <p class="section-more"><a class="btn btn-ghost btn-sm" href="skills/index.html">${escapeHtml(ui('allSkills'))}</a></p>
  </div>
</section>`;
}

function renderHomeProjects(data) {
    const items = data.githubProjects.filter((g) => g.featured).map((g) => `      <article class="home-project">
        <h3 class="case-title"><a href="${escapeHtml(g.url)}" rel="noopener noreferrer">${escapeHtml(g.name)}</a></h3>
        <p>${escapeHtml(g.homeSummary)}</p>
        <p class="role-company">${escapeHtml(g.language)} &middot; ${escapeHtml(ui('stackLabel'))}: ${g.homeStack.map(escapeHtml).join(', ')} &middot; ${escapeHtml(ui('ciLabel'))}: ${escapeHtml(g.ciStatus)}</p>
      </article>`).join('\n');

    return `<section id="projects" class="section section-alt" aria-labelledby="projects-heading">
  <div class="container">
    <h2 id="projects-heading" class="section-title">${escapeHtml(ui('projectsTitle'))}</h2>
    <p class="section-lead">${escapeHtml(ui('projectsLead'))}</p>
    <div class="home-projects">
${items}
    </div>
    <p class="section-more"><a class="btn btn-ghost btn-sm" href="projects/index.html">${escapeHtml(ui('allProjects'))}</a></p>
  </div>
</section>`;
}

function renderHomeContact(data) {
    const { contact } = data.profile;
    return `<section id="contact" class="section" aria-labelledby="contact-heading">
  <div class="container">
    <h2 id="contact-heading" class="section-title">${escapeHtml(ui('contactTitle'))}</h2>
    <p class="section-lead">${escapeHtml(ui('contactLead', { location: data.profile.location }))}</p>
    <ul class="contact-list">
      <li><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></li>
      <li><a href="${escapeHtml(contact.linkedin)}" rel="noopener noreferrer">LinkedIn</a></li>
      <li><a href="${escapeHtml(contact.github)}" rel="noopener noreferrer">GitHub</a></li>
      <li><a href="${escapeHtml(contact.telegram)}" rel="noopener noreferrer">${escapeHtml(ui('telegramLabel'))} ${escapeHtml(contact.telegramHandle)}</a></li>
    </ul>
    <p class="actions"><a class="btn btn-primary" href="${escapeHtml(defaultCvHref(data, localeDepth()))}" download>${escapeHtml(ui('downloadCvPdf'))}</a> <a class="btn btn-ghost" href="cv/index.html">${escapeHtml(ui('contactCvVersions'))}</a></p>
  </div>
</section>`;
}

function renderHomePage(data) {
    const bodyHtml = [
        renderHero(data),
        renderHomeExperience(data),
        renderHomeSkills(data),
        renderHomeProjects(data),
        renderHomeContact(data),
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
                address: { '@type': 'PostalAddress', addressLocality: 'Tallinn', addressCountry: 'EE' },
                sameAs: [data.profile.contact.github, data.profile.contact.linkedin, data.profile.contact.telegram],
                knowsAbout: data.profile.coreSkillGroups.flatMap((group) => group.items),
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
        depth: localeDepth(),
        title: data.site.title,
        description: data.site.description,
        outputPath: pageOutputPath(currentLocaleCode(), 'home'),
        pageKey: 'home',
        ogType: 'profile',
        jsonLd,
        bodyHtml,
    });
}

// Secondary pages keep the full detail. They share the homepage frame and navigation.
function renderSubPage(data, { slug, title, lead, bodyHtml }) {
    const header = `<header class="page-header">
  <div class="container">
    <h1 class="page-title">${escapeHtml(title)}</h1>
    <p class="section-lead">${escapeHtml(lead)}</p>
  </div>
</header>`;
    return renderDocument(data, {
        depth: 1 + localeDepth(),
        title: `${title} | ${data.profile.name}`,
        description: lead,
        outputPath: pageOutputPath(currentLocaleCode(), slug),
        pageKey: slug,
        ogType: 'website',
        jsonLd: null,
        bodyHtml: header + bodyHtml,
    });
}

function renderSecondaryPages(data, techLookup) {
    const depth = 1 + localeDepth();
    return [
        {
            slug: 'experience',
            html: renderSubPage(data, {
                slug: 'experience',
                title: ui('pageExperienceTitle'),
                lead: ui('pageExperienceLead'),
                bodyHtml: renderExperience(data, techLookup, depth) + renderEducation(data),
            }),
        },
        {
            slug: 'projects',
            html: renderSubPage(data, {
                slug: 'projects',
                title: ui('pageProjectsTitle'),
                lead: ui('pageProjectsLead'),
                bodyHtml: renderProjects(data, depth),
            }),
        },
        {
            slug: 'skills',
            html: renderSubPage(data, {
                slug: 'skills',
                title: ui('pageSkillsTitle'),
                lead: ui('pageSkillsLead'),
                bodyHtml: renderSkills(data, depth),
            }),
        },
        {
            slug: 'architecture',
            html: renderSubPage(data, {
                slug: 'architecture',
                title: ui('pageArchitectureTitle'),
                lead: ui('pageArchitectureLead'),
                bodyHtml: renderArchitecture(data, depth),
            }),
        },
    ];
}

function renderCvIndexPage(data) {
    const cards = data.variants.map((v) => `      <article class="card">
        <p class="section-eyebrow">${escapeHtml(v.shortLabel)}</p>
        <h2 class="card-title">${escapeHtml(v.roleTitle)}</h2>
        <p class="card-body">${escapeHtml(v.summary)}</p>
        <div class="hero-actions" style="margin-top:1rem;margin-bottom:0">
          <a class="btn btn-secondary btn-sm" href="${escapeHtml(path.posix.relative(path.posix.dirname(pageOutputPath(currentLocaleCode(), 'cv-index')), `cv/${v.slug}.html`))}">Open Web CV</a>
          <a class="btn btn-primary btn-sm" href="${relPrefix(1 + localeDepth())}assets/pdf/${escapeHtml(v.pdfFilename)}" download>Download PDF</a>
        </div>
      </article>`).join('\n');

    const bodyHtml = `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../index.html">&larr; ${escapeHtml(ui('backToPortfolio'))}</a></p>
    <h1>${escapeHtml(ui('cvIndexTitle'))}</h1>
    <p class="section-lead">${escapeHtml(ui('cvIndexLead'))}</p>
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
        depth: 1 + localeDepth(),
        title: `CV Versions — ${data.profile.name}`,
        description: 'General, Senior Java, Distributed Systems, Fintech, Wise, AI/MCP, and Full CV web and PDF versions for Denis Stepulenok.',
        outputPath: pageOutputPath(currentLocaleCode(), 'cv-index'),
        pageKey: 'cv-index',
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
        outputPath: `cv/${variant.slug}.html`,
        pageKey: `cv/${variant.slug}.html`,
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

const SITEMAP_KEYS = ['home', 'experience', 'projects', 'skills', 'cv-index'];

function pageUrl(data, outputPath) {
    return `${data.site.baseUrl}/${outputPath.replace(/index\.html$/, '')}`;
}

function writeDiscoveryFiles(data) {
    const entries = [];
    for (const key of SITEMAP_KEYS) {
        const alternates = LOCALES.map((locale) => ({
            hreflang: locale.htmlLang,
            href: pageUrl(data, pageOutputPath(locale.code, key)),
        }));
        alternates.push({ hreflang: 'x-default', href: pageUrl(data, pageOutputPath('en', key)) });
        for (const locale of LOCALES) {
            entries.push({ loc: pageUrl(data, pageOutputPath(locale.code, key)), alternates });
        }
    }
    const englishOnly = [
        'architecture/index.html',
        'cv/index.html',
        ...data.variants.map((v) => `cv/${v.slug}.html`),
        ...data.technologies.map((t) => `tech/${t.slug}.html`),
    ];
    for (const page of englishOnly) entries.push({ loc: pageUrl(data, page), alternates: [] });

    const urls = entries.map((entry) => {
        const links = entry.alternates
            .map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}"/>`)
            .join('\n');
        return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${links ? `\n${links}` : ''}\n  </url>`;
    });
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
    const robots = `User-agent: *
Allow: /

Sitemap: ${data.site.baseUrl}/sitemap.xml
`;

    fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemap);
    fs.writeFileSync(path.join(ROOT_DIR, 'robots.txt'), robots);
}

function writePage(relativePath, html) {
    const target = path.join(ROOT_DIR, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
}

function main() {
    const data = loadCvData();
    const problems = validateLocales(data);
    if (problems.length) throw new Error(`Translations are incomplete:\n- ${problems.join('\n- ')}`);

    copyFonts();

    for (const locale of LOCALES) {
        setLocale(locale.code);
        const localized = localizeData(data, locale.code);
        const techLookup = buildTechSlugLookup(localized);

        writePage(pageOutputPath(locale.code, 'home'), renderHomePage(localized));
        for (const page of renderSecondaryPages(localized, techLookup)) {
            // Architecture is English only: it is written once, at the root.
            if (!isTranslatedPage(page.slug) && locale.code !== 'en') continue;
            writePage(pageOutputPath(locale.code, page.slug), page.html);
        }
        writePage(pageOutputPath(locale.code, 'cv-index'), renderCvIndexPage(localized));

        if (locale.code === 'en') {
            for (const variant of localized.variants) {
                writePage(`cv/${variant.slug}.html`, renderVariantPage(localized, variant, techLookup));
            }
            fs.writeFileSync(path.join(ROOT_DIR, 'assets', 'images', 'og-preview.svg'), renderOgSvg(localized));
        }
    }

    writeDiscoveryFiles(data);
    console.log(`Built ${LOCALES.length} languages: ${LOCALES.map((l) => l.code).join(', ')}, ${data.variants.length} CV variants, sitemap.xml, robots.txt`);
}


if (require.main === module) {
    main();
}
