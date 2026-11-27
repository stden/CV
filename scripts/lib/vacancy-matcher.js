const SKILL_ALIASES = [
    { skill: 'Java (6–25)', patterns: [/\bjava\b/i, /\bjdk\b/i] },
    { skill: 'JVM & Concurrency', patterns: [/\bjvm\b/i, /\bconcurren/i, /\bmultithread/i, /\bjmm\b/i] },
    { skill: 'Spring Framework', patterns: [/\bspring framework\b/i, /\bspring mvc\b/i] },
    { skill: 'Spring Boot', patterns: [/\bspring boot\b/i, /\bspring\b/i] },
    { skill: 'Distributed Systems', patterns: [/\bdistributed system/i, /\bidempoten/i, /\bretry/i, /\boutbox\b/i] },
    { skill: 'Microservices', patterns: [/\bmicroservice/i] },
    { skill: 'SQL', patterns: [/\bsql\b/i, /\brelational database/i] },
    { skill: 'PostgreSQL', patterns: [/\bpostgres(?:ql)?\b/i] },
    { skill: 'Oracle Database', patterns: [/\boracle\b/i, /\bpl\/sql\b/i] },
    { skill: 'JPA / Hibernate', patterns: [/\bjpa\b/i, /\bhibernate\b/i, /\borm\b/i] },
    { skill: 'Enterprise Integration', patterns: [/\bintegration/i, /\brest api/i, /\bwebhook/i] },
    { skill: 'Software Design & Algorithms', patterns: [/\bsystem design\b/i, /\balgorithm/i, /\bdata structure/i] },
    { skill: 'RabbitMQ', patterns: [/\brabbitmq\b/i, /\bamqp\b/i] },
    { skill: 'Apache Kafka', patterns: [/\bkafka\b/i, /\bevent streaming\b/i] },
    { skill: 'Redis / Valkey', patterns: [/\bredis\b/i, /\bvalkey\b/i, /\bcaching\b/i] },
    { skill: 'Qdrant', patterns: [/\bqdrant\b/i] },
    { skill: 'Vector Databases (pgvector, Weaviate)', patterns: [/\bpgvector\b/i, /\bweaviate\b/i, /\bvector database/i] },
    { skill: 'Docker / Compose', patterns: [/\bdocker\b/i, /\bcontainer/i] },
    { skill: 'Kubernetes / Helm', patterns: [/\bkubernetes\b/i, /\bk8s\b/i, /\bhelm\b/i] },
    { skill: 'Maven', patterns: [/\bmaven\b/i] },
    { skill: 'Jenkins', patterns: [/\bjenkins\b/i] },
    { skill: 'GitLab CI/CD', patterns: [/\bgitlab\b/i] },
    { skill: 'GitHub Actions', patterns: [/\bgithub actions\b/i] },
    { skill: 'Git', patterns: [/\bgit\b/i] },
    { skill: 'Linux / systemd / bash', patterns: [/\blinux\b/i, /\bbash\b/i, /\bsystemd\b/i] },
    { skill: 'AWS', patterns: [/\baws\b/i, /\bamazon web services\b/i] },
    { skill: 'Terraform', patterns: [/\bterraform\b/i, /\biac\b/i] },
    { skill: 'Prometheus / Grafana', patterns: [/\bprometheus\b/i, /\bgrafana\b/i, /\bobservability\b/i] },
    { skill: 'JUnit', patterns: [/\bjunit\b/i, /\bunit test/i] },
    { skill: 'Mockito / JMockit / EasyMock', patterns: [/\bmockito\b/i, /\bjmockit\b/i, /\beasymock\b/i] },
    { skill: 'Test-Driven Development (TDD)', patterns: [/\btdd\b/i, /\btest-driven\b/i] },
    { skill: 'Integration & E2E Testing', patterns: [/\bintegration test/i, /\be2e\b/i, /\bautomated test/i] },
    { skill: 'Continuous Integration', patterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i] },
    { skill: 'Cucumber / Gherkin (BDD)', patterns: [/\bcucumber\b/i, /\bgherkin\b/i, /\bbdd\b/i] },
    { skill: 'Playwright / Vitest / Selenide', patterns: [/\bplaywright\b/i, /\bvitest\b/i, /\bselenide\b/i] },
    { skill: 'Python (2 & 3)', patterns: [/\bpython\b/i] },
    { skill: 'TypeScript', patterns: [/\btypescript\b/i] },
    { skill: 'Node.js', patterns: [/\bnode\.?js\b/i] },
    { skill: 'Rust', patterns: [/\brust\b/i] },
    { skill: 'Go (Gin, gRPC)', patterns: [/\bgolang\b/i, /\bgo\b/, /\bgrpc\b/i] },
    { skill: 'React', patterns: [/\breact\b/i] },
    { skill: 'AngularJS', patterns: [/\bangular/i] },
    { skill: 'Model Context Protocol (MCP)', patterns: [/\bmcp\b/i, /\bmodel context protocol\b/i] },
    { skill: 'RAG / Embeddings / Semantic Search', patterns: [/\brag\b/i, /\bsemantic search\b/i, /\bembedding/i] },
    { skill: 'Local LLMs / Ollama', patterns: [/\bollama\b/i, /\blocal llm/i] },
    { skill: 'Large Language Models (Claude, GPT, Gemini)', patterns: [/\bllm/i, /\bgenerative ai\b/i, /\bai integration\b/i] },
];

const MISSING_DOMAIN_CHECKS = [
    { label: 'Payment processing / card schemes / clearing rails', pattern: /\b(payment processing|payment rail|sepa|swift|iso\s*20022|card scheme|clearing|settlement)\b/i },
    { label: 'AML / KYC / financial regulatory compliance', pattern: /\b(aml|kyc|anti-money laundering|sanctions screening|pci-dss|regulatory compliance|finra)\b/i },
    { label: 'Core banking / ledger accounting domain', pattern: /\b(core banking|double-entry|general ledger|treasury)\b/i },
    { label: 'Staff / formal people management leadership', pattern: /\b(people management|line manager|direct reports|hiring manager)\b/i },
];

function slugify(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function parseListValue(raw) {
    return String(raw ?? '')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseMarkdownVacancy(rawText, fallbackSlug = 'vacancy') {
    const lines = String(rawText ?? '').replace(/\r\n/g, '\n').split('\n');
    const meta = {};
    const bodyLines = [];
    let inFrontmatter = false;
    let passedFrontmatter = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line.trim() === '---') {
            inFrontmatter = true;
            continue;
        }
        if (inFrontmatter) {
            if (line.trim() === '---') {
                inFrontmatter = false;
                passedFrontmatter = true;
                continue;
            }
            const kv = line.match(/^([A-Za-z][A-Za-z0-9 _-]+):\s*(.*)$/);
            if (kv) meta[kv[1].trim().toLowerCase()] = kv[2].trim();
            continue;
        }
        if (!passedFrontmatter && bodyLines.length === 0) {
            const heading = line.match(/^#\s+(.+)$/);
            if (heading && !meta['job title'] && !meta.jobtitle && !meta.title) {
                meta.jobtitle = heading[1].trim();
                continue;
            }
            const kv = line.match(/^(Company|Job Title|Title|URL|Source|Location|Language|Language Requirements|Employment Type|Deadline|Salary|Salary Range|Required Technologies|Preferred Technologies|Required Competencies|Profile|Slug)\s*:\s*(.+)$/i);
            if (kv) {
                meta[kv[1].trim().toLowerCase()] = kv[2].trim();
                continue;
            }
            if (!line.trim()) continue;
        }
        bodyLines.push(line);
    }

    const company = meta.company || 'Target Company';
    const jobTitle = meta['job title'] || meta.jobtitle || meta.title || 'Senior Software Engineer';
    const url = meta.url || meta.source || 'https://www.linkedin.com/jobs/';
    const slug = meta.slug || slugify(`${company}-${jobTitle}`) || fallbackSlug;

    return {
        slug,
        company,
        jobTitle,
        url,
        description: bodyLines.join('\n').trim() || `${jobTitle} at ${company}`,
        requiredTechnologies: parseListValue(meta['required technologies']),
        preferredTechnologies: parseListValue(meta['preferred technologies']),
        requiredCompetencies: parseListValue(meta['required competencies']),
        location: meta.location || '',
        languageRequirements: meta['language requirements'] || meta.language || '',
        employmentType: meta['employment type'] || '',
        deadline: meta.deadline || '',
        salaryRange: meta['salary range'] || meta.salary || '',
        profile: meta.profile || '',
    };
}

function normaliseVacancy(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Vacancy specification must be an object.');
    }
    if (Array.isArray(input.skills) && Array.isArray(input.projects) && typeof input.summary === 'string' && !input.jobTitle && !input.description) {
        if (typeof input.source !== 'string' || !URL.canParse(input.source) || new URL(input.source).protocol !== 'https:') {
            throw new Error('The vacancy source must be an HTTPS URL.');
        }
        return {
            isLegacySpec: true,
            slug: input.slug,
            company: input.company || 'Target Company',
            jobTitle: input.jobTitle || 'Senior Software Engineer',
            url: input.source,
            source: input.source,
            profile: input.profile,
            summary: input.summary,
            description: input.summary,
            skills: input.skills,
            projects: input.projects,
            requiredTechnologies: input.skills,
            preferredTechnologies: [],
            requiredCompetencies: [],
            location: input.location || '',
            languageRequirements: input.languageRequirements || '',
            employmentType: input.employmentType || '',
            deadline: input.deadline || '',
            salaryRange: input.salaryRange || '',
        };
    }

    const url = input.url || input.source;
    if (typeof url !== 'string' || !URL.canParse(url) || new URL(url).protocol !== 'https:') {
        throw new Error('The vacancy URL/source must be a valid HTTPS URL.');
    }
    const company = String(input.company ?? '').trim();
    const jobTitle = String(input.jobTitle ?? '').trim();
    const description = String(input.description ?? '').trim();
    if (!company || !jobTitle || !description) {
        throw new Error('Vacancy must include non-empty company, jobTitle, and description.');
    }

    const slug = (input.slug && String(input.slug).trim()) || slugify(`${company}-${jobTitle}`);
    if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Use a short slug with lowercase letters, digits and hyphens.');
    }

    const strArray = (val) => (Array.isArray(val) ? val.map((x) => String(x).trim()).filter(Boolean) : []);

    return {
        isLegacySpec: false,
        slug,
        company,
        jobTitle,
        url,
        profile: input.profile ? String(input.profile).trim() : '',
        description,
        requiredTechnologies: strArray(input.requiredTechnologies),
        preferredTechnologies: strArray(input.preferredTechnologies),
        requiredCompetencies: strArray(input.requiredCompetencies),
        location: String(input.location ?? '').trim(),
        languageRequirements: String(input.languageRequirements ?? '').trim(),
        employmentType: String(input.employmentType ?? '').trim(),
        deadline: String(input.deadline ?? '').trim(),
        salaryRange: String(input.salaryRange ?? '').trim(),
    };
}

function findMatchingSkill(requirementText, skillCatalogue) {
    const reqLower = requirementText.toLowerCase();
    for (const item of skillCatalogue) {
        if (item.name.toLowerCase() === reqLower) return item;
    }
    for (const alias of SKILL_ALIASES) {
        if (alias.patterns.some((re) => re.test(requirementText))) {
            const found = skillCatalogue.find((s) => s.name === alias.skill);
            if (found) return found;
        }
    }
    return null;
}

function classifySkillTier(tier) {
    if (tier === 'primary' || tier === 'core') return 'Strong evidence';
    if (tier === 'additional' || tier === 'independent' || tier === 'personal') return 'Partial evidence';
    return 'Familiarity';
}

function matchVacancy(data, vacancy) {
    const skillCatalogue = data.skills.flatMap((group) =>
        group.items.map((skill) => ({ ...skill, groupId: group.id, groupTitle: group.title }))
    );

    const classifications = {
        'Strong evidence': [],
        'Partial evidence': [],
        Familiarity: [],
        'Missing evidence': [],
        'Requires confirmation': [],
    };
    const seenRequirements = new Set();
    const matchedSkillNames = new Set();

    const addFinding = (category, requirement, evidence) => {
        const key = `${category}::${requirement.toLowerCase()}`;
        if (seenRequirements.has(key)) return;
        seenRequirements.add(key);
        classifications[category].push({ requirement, evidence });
    };

    const explicitReqs = [
        ...vacancy.requiredTechnologies.map((r) => ({ text: r, required: true })),
        ...vacancy.preferredTechnologies.map((r) => ({ text: r, required: false })),
        ...vacancy.requiredCompetencies.map((r) => ({ text: r, required: true })),
    ];

    for (const req of explicitReqs) {
        const domainMissing = MISSING_DOMAIN_CHECKS.find((m) => m.pattern.test(req.text));
        if (domainMissing) {
            addFinding('Missing evidence', req.text, 'No verified employer or public project evidence in data/cv.json; do not imply experience.');
            continue;
        }
        const matched = findMatchingSkill(req.text, skillCatalogue);
        if (matched) {
            matchedSkillNames.add(matched.name);
            const category = classifySkillTier(matched.tier);
            addFinding(
                category,
                req.text,
                `${matched.name} (${matched.tier}): ${matched.evidence || 'Listed in verified skills catalogue'}`
            );
            if (matched.tier === 'familiarity') {
                addFinding(
                    'Requires confirmation',
                    `${req.text} production depth`,
                    `Currently categorised as Familiarity in data/cv.json (${matched.evidence || 'requires candidate confirmation'}).`
                );
            }
        } else {
            addFinding(
                'Missing evidence',
                req.text,
                'Not evidenced in data/cv.json; verify before referencing or address honestly as a learning/transferable area.'
            );
        }
    }

    const fullText = [
        vacancy.jobTitle,
        vacancy.description,
        vacancy.languageRequirements,
        vacancy.location,
    ].join('\n');

    for (const alias of SKILL_ALIASES) {
        if (alias.patterns.some((re) => re.test(fullText))) {
            const matched = skillCatalogue.find((s) => s.name === alias.skill);
            if (matched && !matchedSkillNames.has(matched.name)) {
                matchedSkillNames.add(matched.name);
                addFinding(
                    classifySkillTier(matched.tier),
                    matched.name,
                    `Mentioned in job description; ${matched.evidence || 'verified in data/cv.json'}`
                );
            }
        }
    }

    for (const check of MISSING_DOMAIN_CHECKS) {
        if (check.pattern.test(fullText)) {
            addFinding(
                'Missing evidence',
                check.label,
                'Referenced in job description, but no verified direct experience is recorded in data/cv.json.'
            );
        }
    }

    if (vacancy.languageRequirements || /\b(fluent|c1|b2\+|english)\b/i.test(fullText)) {
        const eng = data.languages.find((l) => l.name.toLowerCase() === 'english');
        addFinding(
            'Requires confirmation',
            `Language requirement (${vacancy.languageRequirements || 'English proficiency'})`,
            `CV currently records English: ${eng ? eng.level : 'Intermediate'}. Confirm whether current working proficiency should be updated before applying.`
        );
    }

    if (vacancy.location && !/tallinn|estonia|remote/i.test(vacancy.location)) {
        addFinding(
            'Requires confirmation',
            `Location / relocation (${vacancy.location})`,
            `Profile base is ${data.profile.location}; relocation/work authorisation is disabled by default.`
        );
    }

    return {
        classifications,
        matchedSkillNames: [...matchedSkillNames],
    };
}

module.exports = {
    matchVacancy,
    normaliseVacancy,
    parseMarkdownVacancy,
    slugify,
};
