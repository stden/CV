function selections(items, field) {
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`${field} must be an array of non-empty strings.`);
    }
    return [...new Set(items)];
}

function prepareJobCv(data, specification) {
    const { slug, source, profile, summary } = specification ?? {};
    if (typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Use a short slug with lowercase letters, digits and hyphens.');
    }
    if (typeof source !== 'string' || !URL.canParse(source) || new URL(source).protocol !== 'https:') {
        throw new Error('The vacancy source must be an HTTPS URL.');
    }
    const base = data.variants.find((item) => item.slug === profile);
    if (!base) throw new Error(`Unknown CV profile: ${profile}`);
    if (typeof summary !== 'string' || !summary.trim()) throw new Error('Specify a short factual summary.');

    const names = selections(specification.skills, 'skills');
    const projects = selections(specification.projects, 'projects');
    if (!names.length) throw new Error('Select at least one catalogue skill.');
    const caseIds = new Set(data.caseStudies.map(({ id }) => id));
    for (const id of projects) {
        if (!caseIds.has(id)) throw new Error(`Unknown project: ${id}`);
    }

    const catalogue = new Map(data.skills.flatMap((group) => group.items.map((skill) => [skill.name, { group, skill }])));
    const groups = new Map();
    for (const name of names) {
        const match = catalogue.get(name);
        if (!match) throw new Error(`Unknown skill: ${name}`);
        const { group, skill } = match;
        if (!groups.has(group.id)) groups.set(group.id, { ...group, items: [] });
        groups.get(group.id).items.push(skill);
    }

    return {
        data: { ...data, skills: [...groups.values()] },
        variant: {
            ...base,
            slug,
            summary: summary.trim(),
            pdfFilename: `Denis-Stepulenok-${slug}.pdf`,
            includeCompactRoles: true,
            skillCategoryOrder: [...groups.keys()],
            skillNames: names,
            caseStudyIds: projects,
            githubProjectNames: [],
            focusHighlights: [],
        },
    };
}

module.exports = { prepareJobCv };
