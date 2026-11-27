const aliasesByTerm = {
    java: ['java', 'java core', 'java platform', 'java (6-25)'],
    jvm: ['jvm', 'jdk', 'java memory model', 'jvm & concurrency'],
    'spring framework': ['spring framework', 'spring'],
    'spring boot': ['spring boot'],
    postgresql: ['postgresql', 'postgres'],
    'oracle database': ['oracle database', 'oracle db'],
    sql: ['sql'],
    'relational databases': ['relational databases', 'relational database', 'relational persistence', 'sql databases'],
    'distributed systems': ['distributed systems', 'distributed services', 'distributed backends'],
    microservices: ['microservices', 'microservice architecture'],
    'enterprise integration': ['enterprise integration', 'systems integration', 'system integration patterns', 'enterprise integrations'],
    'asynchronous messaging': ['asynchronous messaging', 'async messaging', 'asynchronous processing', 'message routing', 'message-driven processing'],
    rabbitmq: ['rabbitmq', 'spring amqp', 'amqp'],
    'apache kafka': ['apache kafka', 'kafka'],
    concurrency: ['concurrency', 'concurrent programming', 'concurrent systems', 'thread safety', 'jvm & concurrency'],
    'automated testing': ['automated testing', 'test automation', 'writing testable code', 'automated tests', 'test suite stabilisation'],
    reliability: ['reliability', 'service reliability', 'production reliability', 'operational reliability', 'failure recovery'],
    deployment: ['production deployments', 'production deployment', 'deployment automation', 'release automation'],
    'ci/cd': ['ci/cd', 'continuous integration', 'gitlab ci/cd', 'continuous delivery', 'ci/cd pipelines'],
    kubernetes: ['kubernetes', 'k8s'],
    docker: ['docker', 'docker / compose'],
    typescript: ['typescript'],
    javascript: ['javascript'],
    'node.js': ['node.js', 'nodejs', 'node js'],
    'rest apis': ['rest apis', 'rest api', 'rest'],
    python: ['python', 'python (2 & 3)', 'python 2/3 scripting'],
    rust: ['rust'],
    mcp: ['mcp', 'model context protocol', 'model context protocol (mcp)'],
    'large language models': ['large language models', 'llm', 'llms', 'llm-based systems'],
    'ai integration': ['ai engineering', 'ai integration', 'ai integrations', 'ai automation', 'ai-assisted development'],
    'semantic search': ['semantic search', 'embeddings', 'rag'],
    qdrant: ['qdrant', 'vector indexing'],
    idempotency: ['idempotency', 'idempotent', 'idempotent processing', 'safe retries'],
};

const normalise = (value) => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim();

const exactAliases = new Map();
for (const [term, aliases] of Object.entries(aliasesByTerm)) {
    for (const alias of aliases) if (!exactAliases.has(alias)) exactAliases.set(alias, term);
}
const relatedTerms = {
    postgresql: ['relational databases'],
    'oracle database': ['relational databases'],
    mysql: ['relational databases'],
    'ms sql server': ['relational databases'],
    sql: ['relational databases'],
    rabbitmq: ['asynchronous messaging'],
    jvm: ['java'],
    'spring boot': ['spring framework'],
    jenkins: ['ci/cd'],
    junit: ['automated testing'],
    'gitlab ci/cd': ['ci/cd'],
    gitlab: ['ci/cd'],
};
const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termPatterns = Object.entries(aliasesByTerm).map(([term, aliases]) => [
    term,
    new RegExp(`(?:^|[^a-z0-9])(?:${aliases.map(escapePattern).join('|')})(?:$|[^a-z0-9])`, 'iu'),
]);

function canonical(value) {
    const text = normalise(value);
    if (/^java \((?:\d+[ -]*)+\)$/.test(text)) return 'java';
    return exactAliases.get(text) || text;
}

function conceptsInText(text) {
    const value = normalise(text);
    return termPatterns.filter(([, pattern]) => pattern.test(value)).map(([term]) => term);
}

function literalTerms(label) {
    const value = normalise(label);
    const terms = canonical(value) === value ? [value] : [canonical(value), value];
    for (const term of conceptsInText(value)) {
        if (value.includes('/') || value.includes('&')) terms.push(term);
    }
    for (const term of [...terms]) terms.push(...(relatedTerms[term] || []));
    return [...new Set(terms.filter(Boolean))];
}

function createEvidence(data) {
    const index = [];
    const roles = new Map(data.experience.map((role) => [role.id, role]));
    const cases = new Map(data.caseStudies.map((item) => [item.id, item]));
    for (const role of data.experience) {
        const source = `${role.company} — ${role.role}`;
        for (const item of [...(role.projectTechnologies || []), ...(role.additionalTechnologies || [])]) {
            index.push({ source, detail: item, terms: literalTerms(item), kind: 'employment' });
        }
        for (const detail of role.responsibilities) {
            index.push({ source, detail, terms: conceptsInText(detail), kind: 'employment' });
        }
    }
    for (const item of data.caseStudies.filter(({ scopeType }) => scopeType === 'personal' || scopeType === 'independent')) {
        const source = `${item.title} (independent project)`;
        for (const detail of item.stack) {
            index.push({ source, detail, terms: literalTerms(detail), kind: 'independent' });
        }
        for (const detail of [...item.decisions, ...item.reliability]) {
            index.push({ source, detail, terms: conceptsInText(detail), kind: 'independent' });
        }
    }
    for (const { items } of data.skills) {
        for (const skill of items) {
            const terms = literalTerms(skill.name);
            const documented = (skill.evidence || []).filter(({ kind }) => kind !== 'listed');
            for (const { kind, ref } of documented) {
                if (kind === 'employment' && roles.has(ref)) {
                    const role = roles.get(ref);
                    index.push({ source: `${role.company} — ${role.role}`, detail: skill.name, terms, kind: 'employment' });
                } else if (kind === 'independent' && cases.has(ref)) {
                    index.push({ source: `${cases.get(ref).title} (independent project)`, detail: skill.name, terms, kind: 'independent' });
                } else if (kind === 'public-repository' && typeof ref === 'string') {
                    index.push({ source: 'Independent public repository', url: ref, detail: skill.name, terms, kind: 'independent' });
                }
            }
            index.push({ source: 'Verified CV skills catalogue', detail: skill.name, terms, kind: 'listed' });
        }
    }
    return index;
}

function requirementTerms(requirement) {
    const value = normalise(requirement)
        .replace(/^(?:strong |solid |hands-on )?(?:professional |commercial |production )?(?:(?:experience|knowledge|familiarity)(?: working)? (?:in|of|with) |proficiency in )/, '')
        .replace(/\s+in (?:a )?production(?: environments?)?$/, '')
        .replace(/[.;]$/, '');
    const term = canonical(value);
    const components = value.split(/\s+(?:and|or|plus)\s+|,\s*/).map(canonical);
    const alternatives = /\s+or\s+/.test(value) && !/\s+(?:and|plus|with)\s+|[;,]/.test(value)
        && components.every((part) => part.split(' ').length <= 3);
    return { term, components, alternatives, related: conceptsInText(value) };
}

function matchingEvidence(index, terms) {
    return index.filter((item) => item.terms.some((term) => terms.includes(term)));
}

function summarizeEvidence(items) {
    const seen = new Set();
    return items.filter((entry) => {
        const identity = `${entry.source}\n${entry.detail}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
    }).slice(0, 5).map(({ source, detail, kind, url }) => ({ source, detail, kind, ...(url && { url }) }));
}

function languageMatch(data, requirement) {
    const value = normalise(requirement);
    const language = data.languages.find(({ name }) => value.includes(normalise(name)));
    if (!language) {
        return { status: 'Missing evidence', reason: 'This language does not have a verified level in the CV.', evidence: [], terms: [] };
    }
    const evidence = [{ source: 'Verified CV language entry', detail: `${language.name}: ${language.level}`, kind: 'listed' }];
    if (value === normalise(language.name) || value.includes(normalise(language.level))) {
        return { status: 'Strong evidence', reason: 'The CV records the language and its reported level.', evidence, terms: [] };
    }
    return { status: 'Requires confirmation', reason: 'The recorded level cannot be converted into the requested level or certificate without confirmation.', evidence, terms: [] };
}

function classify(data, index, entry) {
    const { category, requirement } = entry;
    if (category === 'Language requirement') return { ...entry, ...languageMatch(data, requirement) };

    const value = normalise(requirement);
    const { term, components, related, alternatives } = requirementTerms(requirement);
    const direct = matchingEvidence(index, [term]);
    const terms = direct.length ? [term] : [...new Set([...components, ...related])];
    const evidence = direct.length ? direct : matchingEvidence(index, terms);
    const matchedTerms = terms.filter((key) => evidence.some((item) => item.terms.includes(key)));
    const professional = evidence.filter(({ kind }) => kind === 'employment');
    const independent = evidence.filter(({ kind }) => kind === 'independent');
    const requiresProfessional = /\b(?:professional|commercial|production)\s+(?:experience|use|deployment)|\bin production\b/i.test(value);
    const qualified = requiresProfessional ? professional : [...professional, ...independent];
    const verifiedComponents = components.filter((component) => qualified.some((item) => item.terms.includes(component)));
    const fullCoverage = direct.length || (alternatives && verifiedComponents.length)
        || (components.length > 1 && verifiedComponents.length === components.length);
    const confirmedEvidence = summarizeEvidence([...professional, ...independent, ...evidence]);
    let status;
    let reason;

    if (/\b(?:\d+(?:\s*[+–-]\s*\d*)?\s*years?|years of|time zones?|work authori[sz]ation|sponsorship|relocation|certifications?|security clearance|team leadership|people management|mentoring|lead a team)\b/i.test(value)) {
        status = 'Requires confirmation';
        reason = 'The CV does not establish the requested duration, credential, availability or responsibility separately.';
    } else if (!evidence.length) {
        status = 'Missing evidence';
        reason = 'No verified employment, independent project or listed skill supports this requirement.';
    } else if (!professional.length && !independent.length) {
        status = 'Familiarity';
        reason = 'Only a listed skill supports this requirement. Documented professional or independent use is unavailable.';
    } else if (!fullCoverage) {
        status = 'Partial evidence';
        reason = 'Verified experience covers named components of the requirement. Confirm how closely the complete scope aligns.';
    } else if (requiresProfessional && !professional.length) {
        status = 'Partial evidence';
        reason = 'A verified independent project supports the technology. The requested production or professional scope is unconfirmed.';
    } else {
        status = 'Strong evidence';
        reason = professional.length
            ? 'Verified employment records demonstrate the relevant engineering work.'
            : 'A verified independent project demonstrates the relevant engineering work.';
    }
    return { ...entry, status, reason, evidence: confirmedEvidence, terms: matchedTerms };
}

function matchVacancy(data, vacancy) {
    const categories = [
        ['Required technology', vacancy.requiredTechnologies],
        ['Preferred technology', vacancy.preferredTechnologies],
        ['Role technology', vacancy.roleTechnologies],
        ['Required competency', vacancy.requiredCompetencies],
        ['Language requirement', vacancy.languageRequirements],
    ];
    const index = createEvidence(data);
    return categories.flatMap(([category, requirements]) =>
        requirements.map((requirement) => classify(data, index, { category, requirement })));
}

function relevance(text, terms) {
    const value = normalise(text);
    const found = new Set([...conceptsInText(value), ...literalTerms(value)]);
    return terms.reduce((count, term) => count + Number(found.has(term)), 0);
}

module.exports = { matchVacancy, relevance };
