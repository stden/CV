// Checks the content files before anything is rendered. Every rule here protects
// the accuracy of the CV: unique ids, resolvable references, and no skill
// percentages (the old site had them, and they cannot be verified).

const EVIDENCE_VALUES = new Set(['professional', 'personal', 'other']);
const PROJECT_KINDS = new Set(['professional', 'personal']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERCENTAGE = /\d\s*%/;

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) yield* strings(item);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = [];
  for (const value of values) {
    if (seen.has(value)) repeated.push(value);
    seen.add(value);
  }
  return repeated;
}

function checkCv(cv, errors) {
  const experience = [...cv.experience, ...cv.earlierExperience];
  const projectIds = cv.projects.map((project) => project.id);
  const skillGroupIds = cv.skillGroups.map((group) => group.id);

  for (const text of strings(cv)) {
    if (PERCENTAGE.test(text)) errors.push(`cv.json must not contain percentages: "${text.slice(0, 60)}"`);
  }
  for (const id of duplicates([...experience.map((job) => job.id), ...projectIds, ...skillGroupIds])) {
    errors.push(`duplicate id in cv.json: ${id}`);
  }
  for (const job of experience) {
    if (!job.role || !job.organisation || !job.period) errors.push(`experience ${job.id} needs role, organisation and period`);
    for (const highlight of job.highlights ?? []) {
      if (!highlight.text || !Array.isArray(highlight.tags)) errors.push(`highlight in ${job.id} needs text and tags`);
    }
  }
  for (const project of cv.projects) {
    if (!PROJECT_KINDS.has(project.kind)) errors.push(`project ${project.id} has unknown kind ${project.kind}`);
    if (!project.stack?.length) errors.push(`project ${project.id} needs a stack`);
    if (!Array.isArray(project.focus)) errors.push(`project ${project.id} needs a focus array`);
  }
  for (const group of cv.skillGroups) {
    for (const skill of group.skills) {
      if (!EVIDENCE_VALUES.has(skill.evidence)) errors.push(`skill ${skill.name} has unknown evidence ${skill.evidence}`);
    }
  }
}

function checkVariants(variants, cv, errors) {
  const projectIds = new Set(cv.projects.map((project) => project.id));
  const skillGroupIds = new Set(cv.skillGroups.map((group) => group.id));
  for (const id of duplicates(variants.map((variant) => variant.slug))) errors.push(`duplicate variant slug: ${id}`);
  for (const variant of variants) {
    if (!variant.pdf?.endsWith('.pdf')) errors.push(`variant ${variant.slug} needs a .pdf file name`);
    for (const id of variant.projects) {
      if (!projectIds.has(id)) errors.push(`variant ${variant.slug} references unknown project ${id}`);
    }
    for (const id of variant.skillGroups) {
      if (!skillGroupIds.has(id)) errors.push(`variant ${variant.slug} references unknown skill group ${id}`);
    }
    if (variant.maxHighlights !== null && !(Number.isInteger(variant.maxHighlights) && variant.maxHighlights > 0)) {
      errors.push(`variant ${variant.slug} maxHighlights must be null or a positive integer`);
    }
  }
}

function checkArchitecture(architecture, cv, errors) {
  const projectIds = new Set(cv.projects.map((project) => project.id));
  const conceptIds = new Set(architecture.concepts.map((concept) => concept.id));
  for (const diagram of architecture.diagrams) {
    if (!projectIds.has(diagram.id)) errors.push(`diagram ${diagram.id} has no matching project`);
    if (!diagram.components.length) errors.push(`diagram ${diagram.id} has no components`);
    for (const id of diagram.concepts) {
      if (!conceptIds.has(id)) errors.push(`diagram ${diagram.id} references unknown concept ${id}`);
    }
  }
}

function checkSite(site, errors) {
  if (!/^https:\/\//.test(site.origin)) errors.push('site.origin must be an https URL');
  if (!site.basePath.startsWith('/') || !site.basePath.endsWith('/')) errors.push('site.basePath must look like /CV/');
  if (!ISO_DATE.test(site.updated)) errors.push('site.updated must be a YYYY-MM-DD date');
}

function checkGithub(github, errors) {
  for (const id of duplicates(github.projects.map((project) => project.repo))) errors.push(`duplicate repository: ${id}`);
  for (const project of github.projects) {
    if (!ISO_DATE.test(project.lastCommit)) errors.push(`repo ${project.repo} needs a lastCommit date`);
  }
}

function checkTechnologies(technologies, errors) {
  for (const id of duplicates(technologies.map((technology) => technology.slug))) {
    errors.push(`duplicate technology slug: ${id}`);
  }
  for (const technology of technologies) {
    if (!technology.title || !technology.summary) errors.push(`technology ${technology.slug} needs a title and summary`);
  }
}

export function validateContent(content) {
  const errors = [];
  checkCv(content.cv, errors);
  checkVariants(content.variants, content.cv, errors);
  checkArchitecture(content.architecture, content.cv, errors);
  checkSite(content.site, errors);
  checkGithub(content.github, errors);
  checkTechnologies(content.technologies, errors);
  return errors;
}

export function assertValidContent(content) {
  const errors = validateContent(content);
  if (errors.length) throw new Error(`Invalid content:\n- ${errors.join('\n- ')}`);
}
