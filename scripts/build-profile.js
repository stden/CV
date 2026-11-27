const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, loadCvData, escapeHtml } = require('./lib/utils');
const { loadLocales, localize } = require('./lib/i18n');
const { createPublicProfile } = require('./lib/public-profile');
const { renderDocument } = require('./lib/layout');

function resumeSections({ candidate, skillsEvidence }) {
    const work = candidate.employment.flatMap(({ employer, title, period, summary, sourceUrl }) => [
        `${title} — ${employer} (${period})`,
        summary,
        `Source: ${sourceUrl}`,
        '',
    ]);
    const skillsByCategory = new Map();
    for (const skill of skillsEvidence.skills) {
        if (!skillsByCategory.has(skill.category)) skillsByCategory.set(skill.category, []);
        skillsByCategory.get(skill.category).push(skill.name);
    }
    const skills = [...skillsByCategory].map(([category, names]) => `${category}: ${names.join(', ')}`);
    return [
        ['Profile', [candidate.professionalTitle, candidate.location, candidate.summary]],
        ['Employment', ['Employment is candidate-reported.', '', ...work]],
        ['Technical skills', skills],
        ['Independent projects', candidate.projects.flatMap(({ name, summary, url }) => [name, summary, url, ''])],
        ['Languages', candidate.languages.map(({ name, level }) => `${name}: ${level}`)],
        ['Contact and CV', [
            candidate.profiles.contact, candidate.profiles.linkedin, candidate.profiles.github, candidate.cv.web, candidate.cv.pdf,
        ]],
    ];
}

function renderResume(profile, markdown) {
    const { candidate } = profile;
    const title = markdown ? '# ' + candidate.name : candidate.name;
    const heading = (name) => markdown ? '## ' + name : name.toUpperCase();
    const contents = [
        title,
        `Canonical profile: ${candidate.canonicalProfileUrl}`,
        `Schema version: ${candidate.schemaVersion}`,
        `Content revised: ${candidate.contentRevisionDate}`,
        ...resumeSections(profile).map(([section, lines]) => [heading(section), ...lines].join('\n')),
    ];
    if (!markdown) return contents.join('\n\n') + '\n';
    return contents.map((section) => section
        .split('\n')
        .filter(Boolean)
        .map((line) => line.replace(/(https:\/\/\S+)$/, '<$1>'))
        .join('\n\n')).join('\n\n') + '\n';
}

function renderLlms(candidate) {
    const { canonicalProfileUrl: base } = candidate;
    return `# ${candidate.name}

> ${candidate.professionalTitle}. ${candidate.location}.

The English portfolio is the canonical profile. Employment is candidate-reported. Independent work is documented separately. Schema version ${candidate.schemaVersion}. Content revised ${candidate.contentRevisionDate}.

## Professional profile

- [Portfolio](${base}): Summary, experience, skills and contact.
- [Resume Markdown](${base}resume.md): Human-readable CV with sources.
- [Resume text](${base}resume.txt): Plain-text CV.
- [English CV PDF](${candidate.cv.pdf}): Tagged A4 resume.
- [Candidate profile](${base}candidate.json): Structured identity, experience and public projects.

## Evidence

- [Skills evidence](${base}skills-evidence.json): Skill tiers, verification status and source links.
- [Role alignment](${base}role-alignment/): Competencies, limitations and questions to confirm.
- [Role alignment data](${base}role-alignment.json): The same alignment in JSON.
- [Engineering articles](${base}articles/): Independent notes, sources and experiments.
`;
}

const alignmentLabels = {
    'primary-target': 'Primary target',
    'related-role': 'Related role',
    'independent-project-fit': 'Alignment through independent projects',
};
const list = (items) => items.map((value) => `<li>${escapeHtml(value)}</li>`).join('');

function roleSources(competencies, canonicalProfileUrl) {
    const links = (accepts) => {
        const distinct = new Map();
        for (const { evidence } of competencies) {
            for (const entry of evidence.filter(accepts)) {
                const source = entry.sourceUrls[0];
                const href = source.startsWith(canonicalProfileUrl) ? '../' + source.slice(canonicalProfileUrl.length) : source;
                distinct.set(entry.context.id, `<a href="${escapeHtml(href)}">${escapeHtml(entry.context.name)}</a>`);
            }
        }
        return [...distinct.values()].join(' · ');
    };
    const employment = links(({ type }) => type === 'employment');
    const independent = links(({ type }) => type === 'independent-project' || type === 'public-repository');
    return [
        employment && `<p><strong>Candidate-reported employment</strong><br>${employment}</p>`,
        independent && `<p><strong>Independent work</strong><br>${independent}</p>`,
    ].filter(Boolean).join('\n');
}

function renderRoleAlignment(data, { roleAlignment, skillsEvidence }) {
    const skills = new Map(skillsEvidence.skills.map((skill) => [skill.id, skill]));
    const cards = roleAlignment.roles.map((role) => {
        const competencies = role.competencyIds.map((id) => skills.get(id));
        return `<article class="card" id="${escapeHtml(role.id)}">
  <p class="section-eyebrow">${escapeHtml(alignmentLabels[role.alignment])}</p>
  <h2 class="card-title">${escapeHtml(role.title)}</h2>
  <ul class="badge-list">${competencies.map(({ name }) => `<li><span class="badge">${escapeHtml(name)}</span></li>`).join('')}</ul>
  ${roleSources(competencies, roleAlignment.canonicalProfileUrl)}
  <h3>Evidence limits</h3>
  <ul class="bullet-list">${list(role.limitations)}</ul>
  <h3>Confirm for the vacancy</h3>
  <ul class="bullet-list">${list(role.requiresConfirmation)}</ul>
</article>`;
    }).join('\n');
    const description = 'Evidence, limitations and questions to confirm for Java backend, distributed systems and related engineering roles.';
    return renderDocument(data, {
        depth: 1,
        canonicalPath: 'role-alignment/',
        title: `Role alignment — ${data.profile.name}`,
        description,
        bodyHtml: `<section class="subpage-hero">
  <div class="container">
    <p class="breadcrumb"><a href="../">Portfolio</a> / Role alignment</p>
    <h1>Role alignment</h1>
    <p class="section-lead">${description} The employment record is available in the <a href="../experience/">experience timeline</a>.</p>
    <p><a href="../skills/">Skills catalogue</a> · <a href="../skills-evidence.json">Skills evidence JSON</a> · <a href="../role-alignment.json">Role alignment JSON</a></p>
  </div>
</section>
<section class="section section-alt" aria-label="Engineering roles">
  <div class="container repo-grid">
    ${cards}
  </div>
</section>`,
    });
}

function main() {
    const data = loadCvData();
    const profile = createPublicProfile(data);
    const files = {
        'candidate.json': JSON.stringify(profile.candidate, null, 2) + '\n',
        'skills-evidence.json': JSON.stringify(profile.skillsEvidence, null, 2) + '\n',
        'role-alignment.json': JSON.stringify(profile.roleAlignment, null, 2) + '\n',
        'resume.md': renderResume(profile, true),
        'resume.txt': renderResume(profile, false),
        'llms.txt': renderLlms(profile.candidate),
    };
    const english = localize(data, 'en', loadLocales(data).en);
    fs.mkdirSync(path.join(ROOT_DIR, 'role-alignment'), { recursive: true });
    files['role-alignment/index.html'] = renderRoleAlignment(english, profile);
    for (const [file, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(ROOT_DIR, file), content);
    }
    console.log('Built public resume formats, skills evidence and role alignment.');
}

if (require.main === module) main();

module.exports = { renderResume, renderLlms };
