const { localizedPdfName } = require('./i18n');

const PROFILE_FORMATS = {
    'llms.txt': 'text/plain',
    'resume.md': 'text/markdown',
    'resume.txt': 'text/plain',
    'candidate.json': 'application/json',
    'skills-evidence.json': 'application/json',
    'role-alignment.json': 'application/json',
};
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const categories = {
    core: 'primary-professional',
    additional: 'additional-professional',
    personal: 'independent-work',
    familiarity: 'familiarity',
};

function identity(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function select(items, ids, key) {
    const index = new Map(items.map((item) => [item[key], item]));
    if (!Array.isArray(ids) || ids.length !== new Set(ids).size || ids.some((id) => !index.has(id))) {
        throw new Error('PUBLIC_PROFILE_SELECTION_INVALID');
    }
    return ids.map((id) => index.get(id));
}

function sourceRecords(project, verification) {
    const prefix = project.url + '/';
    const sources = [{ type: 'repository', url: project.url }];
    for (const { kind, url } of verification?.sources ?? []) {
        if (['source', 'documentation', 'test'].includes(kind) && typeof url === 'string' && url.startsWith(prefix)) {
            sources.push({ type: kind, url });
        }
    }
    return sources;
}

function buildProjects(data, approved) {
    return select(data.githubProjects, approved, 'name').map((project) => {
        if (!/^https:\/\/github\.com\/stden\/[A-Za-z0-9_.-]+$/.test(project.url)) {
            throw new Error('PUBLIC_PROFILE_SOURCE_INVALID');
        }
        const verification = data.githubProjectVerification?.[project.name];
        const verified = datePattern.test(verification?.verifiedAt ?? '');
        const sources = sourceRecords(project, verified ? verification : undefined);
        return {
            id: identity(project.name),
            name: project.name,
            url: project.url,
            summary: project.description,
            sources,
            lastVerifiedDate: verified ? verification.verifiedAt : null,
            ci: verified && verification.ciUrl
                ? { status: verification.ciStatus, url: verification.ciUrl }
                : { status: 'Not verified' },
        };
    });
}

function skillEvidence(skill, entry, profile) {
    const { employmentById, projectsByUrl, caseById, caseRepoNames, projects, url } = profile;
    if (entry.kind === 'employment') {
        const role = employmentById.get(entry.ref);
        if (!role) return null;
        return {
            id: `${skill.id}-employment-${role.id}`,
            type: 'employment',
            context: { id: role.id, name: role.employer },
            verificationStatus: 'candidate-reported',
            lastVerifiedDate: null,
            sourceUrls: [role.sourceUrl],
            limitations: ['A citation to the candidate’s CV records the reported scope. Employer attestation is unavailable.'],
        };
    }

    if (entry.kind === 'listed') {
        return {
            id: `${skill.id}-catalogue`,
            type: 'catalogue',
            context: { id: 'skills', name: 'Published skills catalogue' },
            verificationStatus: 'candidate-listed',
            lastVerifiedDate: null,
            sourceUrls: [url('skills/')],
            limitations: ['Familiarity is listed without evidence of production use.'],
        };
    }

    const caseStudy = entry.kind === 'independent' ? caseById.get(entry.ref) : undefined;
    const project = caseStudy
        ? projects.find(({ name }) => name === caseRepoNames[caseStudy.id])
        : projectsByUrl.get(entry.ref);
    if (!caseStudy && !project) return null;
    const inspected = project?.sources.some(({ type }) => type === 'source');
    return {
        id: `${skill.id}-${entry.kind}-${caseStudy?.id ?? project.id}`,
        type: entry.kind === 'independent' ? 'independent-project' : 'public-repository',
        context: { id: caseStudy?.id ?? project.id, name: caseStudy?.title ?? project.name },
        verificationStatus: inspected ? 'public-source-link-verified' : 'candidate-described',
        lastVerifiedDate: inspected ? project.lastVerifiedDate : null,
        sourceUrls: [
            ...(caseStudy ? [url(`projects/#case-${caseStudy.id}`)] : []),
            ...(project?.sources.map(({ url: source }) => source) ?? []),
        ],
        limitations: ['Independent evidence demonstrates the documented scope and does not establish employer usage.'],
    };
}

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];

function employmentDates(period) {
    const match = /^([A-Za-z]+) (\d{4}) – (?:([A-Za-z]+) (\d{4})|(Present))$/.exec(period);
    if (!match) throw new Error('PUBLIC_EMPLOYMENT_PERIOD_INVALID');
    const [, startMonth, startYear, endMonth, endYear, current] = match;
    const monthDate = (year, month) => {
        const number = monthNames.indexOf(month) + 1;
        if (number < 1) throw new Error('PUBLIC_EMPLOYMENT_PERIOD_INVALID');
        return `${year}-${String(number).padStart(2, '0')}`;
    };
    const startDate = monthDate(startYear, startMonth);
    const endDate = current ? null : monthDate(endYear, endMonth);
    if (endDate && endDate < startDate) throw new Error('PUBLIC_EMPLOYMENT_PERIOD_INVALID');
    return { startDate, endDate };
}

function createPublicProfile(data) {
    const approved = data.publicProfile;
    if (!approved || !datePattern.test(approved.contentRevisionDate)) throw new Error('PUBLIC_PROFILE_REVISION_INVALID');
    const url = (suffix = '') => `${data.site.baseUrl}/${suffix}`;
    const metadata = { schemaVersion: '1.0.0', canonicalProfileUrl: url(), contentRevisionDate: approved.contentRevisionDate };
    const employment = select(data.experience, approved.employmentIds, 'id').map((entry) => ({
        id: entry.id, employer: entry.company, title: entry.role, period: entry.period, ...employmentDates(entry.period),
        summary: entry.summary, sourceUrl: url(`experience/#role-${entry.id}`), verificationStatus: 'candidate-reported',
    }));
    const projects = buildProjects(data, approved.projectNames);
    const context = {
        employmentById: new Map(employment.map((entry) => [entry.id, entry])),
        projectsByUrl: new Map(projects.map((project) => [project.url, project])),
        caseById: new Map(data.caseStudies.map((item) => [item.id, item])),
        caseRepoNames: approved.caseRepositoryNames,
        projects,
        url,
    };

    const skills = select(data.skills.flatMap((group) => group.items), approved.skillIds, 'id').map((skill) => {
        if (!idPattern.test(skill.id) || !Object.hasOwn(categories, skill.tier)) throw new Error('PUBLIC_SKILL_INVALID');
        const evidence = skill.evidence.map((entry) => skillEvidence(skill, entry, context)).filter(Boolean);
        if (!evidence.length) evidence.push({
            id: `${skill.id}-catalogue`, type: 'catalogue',
            context: { id: 'skills', name: 'Published skills catalogue' },
            verificationStatus: 'candidate-listed', lastVerifiedDate: null, sourceUrls: [url('skills/')],
            limitations: ['This export contains no reviewed public source for this catalogue entry.'],
        });
        return {
            id: skill.id,
            name: skill.name,
            synonyms: skill.synonyms ?? [],
            category: categories[skill.tier],
            evidence,
        };
    });
    const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
    const roles = approved.roleAlignment.map(({ id, title, alignment, competencyIds, limitations, requiresConfirmation }) => {
        if (!idPattern.test(id) || !competencyIds.every((skillId) => skillsById.has(skillId))) {
            throw new Error('PUBLIC_ROLE_ALIGNMENT_INVALID');
        }
        return {
            id, title, alignment, competencyIds, limitations, requiresConfirmation,
            evidenceIds: competencyIds.flatMap((skillId) => skillsById.get(skillId).evidence.map(({ id: evidenceId }) => evidenceId)),
            sourceUrl: url(`role-alignment/#${id}`),
        };
    });

    const candidate = {
        ...metadata,
        language: 'en',
        name: data.profile.name,
        professionalTitle: data.profile.title,
        summary: data.profile.summary,
        location: data.profile.location,
        profiles: { github: data.profile.contact.github, linkedin: data.profile.contact.linkedin, contact: url('contact/') },
        cv: { web: url('cv/general.html'), pdf: url(`assets/pdf/${localizedPdfName('en')}`) },
        languages: data.languages.map(({ name, level }) => ({ name, level })),
        employment,
        projects,
    };
    return { candidate, skillsEvidence: { ...metadata, skills }, roleAlignment: { ...metadata, roles } };
}

module.exports = { PROFILE_FORMATS, createPublicProfile };
