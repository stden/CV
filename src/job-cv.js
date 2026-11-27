const { cv, variants } = require('./cv-data');

function ids(values, field) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value)) {
        throw new Error(`${field} must be an array of catalogue IDs.`);
    }
    return [...new Set(values)];
}

function prepareJobCv(specification) {
    const { slug, source, summary, profile } = specification ?? {};
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
        throw new Error('Use a short slug with lowercase letters, digits and hyphens.');
    }
    const base = variants.find((variant) => variant.slug === profile);
    if (!base) throw new Error(`Unknown CV profile: ${profile}`);
    if (typeof summary !== 'string' || !summary.trim()) throw new Error('Specify a short CV summary.');
    if (typeof source !== 'string' || !URL.canParse(source) || new URL(source).protocol !== 'https:') {
        throw new Error('The job source must be an HTTPS vacancy URL.');
    }
    const skillIds = ids(specification.skills, 'skills');
    const projectIds = ids(specification.projects, 'projects');
    if (!skillIds.length) throw new Error('Select at least one catalogue skill.');
    for (const id of projectIds) {
        if (!cv.projects.some((project) => project.id === id)) throw new Error(`Unknown project: ${id}`);
    }

    const catalogue = new Map(cv.skills.flatMap((group) => group.entries.map((entry) => [entry.id, { entry, group }])));
    const selected = new Map();
    for (const id of skillIds) {
        const match = catalogue.get(id);
        if (!match) throw new Error(`Unknown skill: ${id}`);
        const { entry, group } = match;
        if (!selected.has(group.id)) selected.set(group.id, { ...group, entries: [], items: [] });
        const selection = selected.get(group.id);
        selection.entries.push(entry);
        selection.items.push(entry.name);
    }

    return {
        cv: { ...cv, skills: [...selected.values()] },
        variant: {
            slug,
            title: base.title,
            summary: summary.trim(),
            skills: [...selected.keys()],
            projects: projectIds,
            filename: `Denis-Stepulenok-${slug}.pdf`,
        },
    };
}

module.exports = { prepareJobCv };
