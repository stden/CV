const { VacancyError, normaliseVacancy } = require('./vacancy');
const { matchVacancy, relevance } = require('./vacancy-match');

function selectProfile(data, vacancy) {
    const targetsJava = /\b(?:java|jvm|spring boot)\b/i.test([vacancy.title, ...vacancy.requiredTechnologies].join(' '));
    const slug = vacancy.profile || (targetsJava ? 'senior-java' : 'general');
    const base = data.variants.find((item) => item.slug === slug);
    if (!base) throw new VacancyError('Unknown CV profile. Use a profile from the CV source data.');
    return base;
}

function rank(items, describe, terms) {
    return items.map((item) => ({ item, score: relevance(describe(item), terms) }))
        .sort((left, right) => right.score - left.score);
}

function chooseSkills(data, base, vacancy, requests, terms) {
    const catalog = data.skills.flatMap((group) => group.items.map((skill) => ({ group, skill })));
    const byName = new Map(catalog.map((item) => [item.skill.name, item]));
    if (vacancy.skills) {
        if (!vacancy.skills.length) throw new VacancyError('Select at least one catalogue skill.');
        const selected = vacancy.skills.map((name) => byName.get(name));
        if (selected.some((item) => !item)) throw new VacancyError('Unknown skill. Select existing CV catalogue skills.');
        return selected;
    }

    const documented = catalog.filter(({ skill }) => skill.tier !== 'familiarity');
    const prioritized = rank(documented, ({ skill }) => skill.name, terms)
        .filter(({ score }) => score > 0)
        .map(({ item }) => item);
    const baseline = base.skillNames
        ? base.skillNames.map((name) => byName.get(name)).filter(Boolean)
        : base.skillCategoryOrder.flatMap((id) => documented.filter(({ group }) => group.id === id));
    const topics = requests.filter(({ status }) => status === 'Familiarity').flatMap(({ terms }) => terms);
    const familiar = catalog.filter(({ skill }) => skill.tier === 'familiarity' && relevance(skill.name, topics) > 0).slice(0, 2);
    const chosen = [...new Set([...prioritized, ...baseline])].filter(({ skill }) => skill.tier !== 'familiarity');
    return [...chosen.slice(0, 16 - familiar.length), ...familiar];
}

function groupSkills(selected) {
    const groups = new Map();
    for (const { group, skill } of selected) {
        if (!groups.has(group.id)) groups.set(group.id, { ...group, items: [] });
        groups.get(group.id).items.push(skill);
    }
    return [...groups.values()];
}

function chooseProjects(data, base, vacancy, terms) {
    const allowed = data.caseStudies.filter(({ scopeType }) => scopeType === 'personal' || scopeType === 'independent');
    if (vacancy.projects) {
        const byId = new Set(allowed.map(({ id }) => id));
        if (vacancy.projects.some((id) => !byId.has(id))) {
            throw new VacancyError('Unknown project. Select existing public independent projects.');
        }
        return vacancy.projects;
    }
    const matches = rank(allowed, (item) => [item.title, item.problem, ...item.stack, ...item.reliability].join(' '), terms)
        .filter(({ score }) => score > 0).map(({ item }) => item.id);
    return [...new Set([...matches, ...base.caseStudyIds.filter((id) => allowed.some((item) => item.id === id))])].slice(0, 2);
}

function prepareJobCv(data, specification) {
    const vacancy = normaliseVacancy(specification);
    const base = selectProfile(data, vacancy);
    const match = matchVacancy(data, vacancy);
    const relevantTerms = [...new Set(match
        .filter(({ status }) => ['Strong evidence', 'Partial evidence', 'Requires confirmation'].includes(status))
        .flatMap(({ terms }) => terms))];
    const selected = chooseSkills(data, base, vacancy, match, relevantTerms);
    const skills = groupSkills(selected);
    const experience = data.experience.map((role) => ({
        ...role,
        responsibilities: rank(role.responsibilities, (item) => item, relevantTerms).map(({ item }) => item),
    }));
    const projects = chooseProjects(data, base, vacancy, relevantTerms);

    return {
        vacancy,
        match,
        data: { ...data, skills, experience },
        variant: {
            ...base,
            slug: 'application',
            pdfFilename: 'resume.pdf',
            includeCompactRoles: true,
            skillCategoryOrder: skills.map(({ id }) => id),
            skillNames: selected.map(({ skill }) => skill.name),
            caseStudyIds: projects,
            githubProjectNames: [],
            focusHighlights: [],
        },
    };
}

module.exports = { prepareJobCv };
