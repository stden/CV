function selections(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} must be an array of non-empty strings.`);
  }
  return [...new Set(value)];
}

export function prepareJobCv(content, specification) {
  const { slug, source, profile, summary } = specification ?? {};
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    throw new Error('Use a short slug with lowercase letters, digits and hyphens.');
  }
  if (typeof source !== 'string' || !URL.canParse(source) || new URL(source).protocol !== 'https:') {
    throw new Error('The vacancy source must be an HTTPS URL.');
  }
  const base = content.variants.find((variant) => variant.slug === profile);
  if (!base) throw new Error(`Unknown CV profile: ${profile}`);
  if (typeof summary !== 'string' || !summary.trim()) throw new Error('Specify a short factual summary.');

  const projects = selections(specification.projects, 'projects');
  const focus = selections(specification.focus ?? base.focus, 'focus');
  const skills = selections(specification.skills, 'skills');
  if (!skills.length) throw new Error('Select at least one catalogue skill.');

  const projectIds = new Set(content.cv.projects.map(({ id }) => id));
  const focusTags = new Set([
    ...content.cv.experience.flatMap((job) => job.highlights.flatMap(({ tags }) => tags)),
    ...content.cv.projects.flatMap((project) => project.focus)
  ]);
  const catalogue = new Map(content.cv.skillGroups.flatMap((group) => group.skills.map((skill) => [skill.name, { group, skill }])));
  for (const id of projects) {
    if (!projectIds.has(id)) throw new Error(`Unknown project: ${id}`);
  }
  for (const tag of focus) {
    if (!focusTags.has(tag)) throw new Error(`Unknown focus tag: ${tag}`);
  }

  const groups = new Map();
  for (const name of skills) {
    const entry = catalogue.get(name);
    if (!entry) throw new Error(`Unknown skill: ${name}`);
    const { group, skill } = entry;
    if (!groups.has(group.id)) groups.set(group.id, { ...group, skills: [] });
    groups.get(group.id).skills.push(skill);
  }

  return {
    content: { ...content, cv: { ...content.cv, skillGroups: [...groups.values()] } },
    variant: {
      ...base,
      slug,
      pdf: `Denis-Stepulenok-${slug}.pdf`,
      summary: summary.trim(),
      skillGroups: [...groups.keys()],
      projects,
      focus
    }
  };
}
