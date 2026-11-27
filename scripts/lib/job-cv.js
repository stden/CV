const { matchVacancy, normaliseVacancy } = require('./vacancy-matcher');

function selections(items, field) {
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`${field} must be an array of non-empty strings.`);
    }
    return [...new Set(items)];
}

function chooseProfile(data, vacancy) {
    if (vacancy.profile) {
        const explicit = data.variants.find((item) => item.slug === vacancy.profile);
        if (!explicit) throw new Error(`Unknown CV profile: ${vacancy.profile}`);
        return explicit;
    }
    const text = `${vacancy.jobTitle} ${vacancy.description} ${vacancy.requiredTechnologies.join(' ')}`.toLowerCase();
    if (/\b(mcp|rag|llm|ai integration|semantic search|qdrant)\b/.test(text)) {
        return data.variants.find((v) => v.slug === 'ai-mcp') || data.variants[0];
    }
    if (/\b(distributed|outbox|kafka|idempoten|concurrency)\b/.test(text)) {
        return data.variants.find((v) => v.slug === 'distributed-systems') || data.variants[0];
    }
    if (/\bjava\b/.test(text)) {
        return data.variants.find((v) => v.slug === 'senior-java') || data.variants[0];
    }
    return data.variants.find((v) => v.slug === 'general') || data.variants[0];
}

function scoreTokens(text, keywords) {
    const lower = String(text ?? '').toLowerCase();
    let score = 0;
    for (const kw of keywords) {
        if (kw && lower.includes(kw)) score += 1;
    }
    return score;
}

function prepareJobCv(data, rawSpecification) {
    const vacancy = normaliseVacancy(rawSpecification);

    if (vacancy.isLegacySpec) {
        const slug = vacancy.slug;
        if (typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            throw new Error('Use a short slug with lowercase letters, digits and hyphens.');
        }
        const base = chooseProfile(data, vacancy);
        if (typeof vacancy.summary !== 'string' || !vacancy.summary.trim()) {
            throw new Error('Specify a short factual summary.');
        }
        const names = selections(vacancy.skills, 'skills');
        const projects = selections(vacancy.projects, 'projects');
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

        const matchResult = matchVacancy(data, vacancy);
        return {
            vacancy,
            matchResult,
            data: { ...data, skills: [...groups.values()] },
            variant: {
                ...base,
                slug,
                summary: vacancy.summary.trim(),
                pdfFilename: 'resume.pdf',
                includeCompactRoles: true,
                skillCategoryOrder: [...groups.keys()],
                skillNames: names,
                caseStudyIds: projects,
                githubProjectNames: base.githubProjectNames || [],
                focusHighlights: [],
            },
        };
    }

    const base = chooseProfile(data, vacancy);
    const matchResult = matchVacancy(data, vacancy);

    const keywords = [
        ...vacancy.requiredTechnologies,
        ...vacancy.preferredTechnologies,
        ...vacancy.requiredCompetencies,
        ...vacancy.jobTitle.split(/\W+/),
    ]
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length >= 2);

    // Select verified skills: matched skills (except unrequested familiarity) + base variant skills
    const catalogue = data.skills.flatMap((group) => group.items.map((skill) => ({ ...skill, group })));
    const selectedOrder = [];
    const selectedSet = new Set();

    for (const name of matchResult.matchedSkillNames) {
        const found = catalogue.find((c) => c.name === name);
        if (found && !selectedSet.has(name)) {
            selectedSet.add(name);
            selectedOrder.push(found);
        }
    }
    for (const name of base.skillNames || []) {
        const found = catalogue.find((c) => c.name === name);
        if (found && !selectedSet.has(name)) {
            selectedSet.add(name);
            selectedOrder.push(found);
        }
    }

    const groups = new Map();
    for (const entry of selectedOrder) {
        if (!groups.has(entry.group.id)) groups.set(entry.group.id, { ...entry.group, items: [] });
        groups.get(entry.group.id).items.push(entry);
    }

    // Reorder verified responsibility bullets only (never alter dates, company names, titles, or languages)
    const reorderedExperience = data.experience.map((role) => {
        const sortedResponsibilities = [...role.responsibilities].sort((a, b) => {
            return scoreTokens(b, keywords) - scoreTokens(a, keywords);
        });
        return {
            ...role,
            responsibilities: sortedResponsibilities,
        };
    });

    const rankedCases = [...data.caseStudies]
        .sort((a, b) => {
            const scoreA = scoreTokens(`${a.title} ${a.architecture} ${a.stack.join(' ')}`, keywords);
            const scoreB = scoreTokens(`${b.title} ${b.architecture} ${b.stack.join(' ')}`, keywords);
            return scoreB - scoreA;
        })
        .slice(0, 2)
        .map((c) => c.id);

    const rankedRepos = [...data.githubProjects]
        .sort((a, b) => {
            const scoreA = scoreTokens(`${a.name} ${a.language} ${a.description} ${(a.concepts || []).join(' ')}`, keywords);
            const scoreB = scoreTokens(`${b.name} ${b.language} ${b.description} ${(b.concepts || []).join(' ')}`, keywords);
            return scoreB - scoreA;
        })
        .slice(0, 3)
        .map((r) => r.name);

    return {
        vacancy,
        matchResult,
        data: {
            ...data,
            experience: reorderedExperience,
            skills: [...groups.values()],
        },
        variant: {
            ...base,
            slug: vacancy.slug,
            roleTitle: base.roleTitle,
            summary: base.summary,
            pdfFilename: 'resume.pdf',
            includeCompactRoles: false,
            skillCategoryOrder: [...groups.keys()],
            skillNames: selectedOrder.map((s) => s.name),
            caseStudyIds: rankedCases,
            githubProjectNames: rankedRepos,
            focusHighlights: base.focusHighlights || [],
        },
    };
}

function renderMatchReportMarkdown(vacancy, matchResult) {
    const lines = [
        `# Vacancy Match Report — ${vacancy.jobTitle} (${vacancy.company})`,
        '',
        `- **Source:** ${vacancy.url}`,
        `- **Generated:** ${new Date().toISOString().slice(0, 10)}`,
        vacancy.location ? `- **Location:** ${vacancy.location}` : null,
        vacancy.languageRequirements ? `- **Language requirement:** ${vacancy.languageRequirements}` : null,
        vacancy.employmentType ? `- **Employment type:** ${vacancy.employmentType}` : null,
        vacancy.deadline ? `- **Application deadline:** ${vacancy.deadline}` : null,
        vacancy.salaryRange ? `- **Salary range (from posting):** ${vacancy.salaryRange}` : null,
        '',
        '> **Policy note:** Requirements are classified strictly by verified evidence in `data/cv.json`. No speculative percentage match or offer probability is generated.',
        '',
    ].filter((l) => l !== null);

    for (const category of ['Strong evidence', 'Partial evidence', 'Familiarity', 'Missing evidence', 'Requires confirmation']) {
        lines.push(`## ${category}`);
        const items = matchResult.classifications[category];
        if (!items.length) {
            lines.push('- None identified.');
        } else {
            for (const item of items) {
                lines.push(`- **${item.requirement}:** ${item.evidence}`);
            }
        }
        lines.push('');
    }
    return lines.join('\n');
}

function renderCoverLetterMarkdown(data, vacancy, matchResult) {
    const strong = matchResult.classifications['Strong evidence'].slice(0, 6).map((i) => i.requirement);
    const missing = matchResult.classifications['Missing evidence'].map((i) => i.requirement);

    return [
        `# Cover Letter Draft — ${vacancy.jobTitle} at ${vacancy.company}`,
        '',
        `Dear ${vacancy.company} Hiring Team,`,
        '',
        `I am writing to express my interest in the ${vacancy.jobTitle} role (${vacancy.url}). I am a Senior Software Engineer based in ${data.profile.location} specialising in Java backend development, distributed systems, enterprise integration, JVM concurrency, and production reliability.`,
        '',
        'Across my professional career, I have contributed to:',
        '- **Kuehne+Nagel (May 2018 – Present):** Developing and maintaining enterprise Java and Spring Boot services, asynchronous RabbitMQ integrations, PostgreSQL and Oracle persistence layers, automated JUnit/Mockito test suites, and containerised CI/CD pipelines.',
        '- **Taxify, now Bolt (May 2017 – May 2018):** Building high-load backend REST APIs and microservices in Node.js and TypeScript alongside Redis caching and Dockerised deployments.',
        '- **Oracle (January 2014 – May 2017):** Investigating Java Core defects across the Java Memory Model, concurrency, and class loading, and automating distributed test execution in Java and Python.',
        '',
        strong.length
            ? `Key verified areas aligned with this role include: ${strong.join(', ')}. Outside employer work, I maintain public projects such as EntityLocker (a JVM-local per-entity concurrency utility in Java) and personal Rust/Python pipelines exploring PostgreSQL row-locked queues and idempotent semantic indexing.`
            : 'Outside employer work, I maintain public Java, Rust, and Python engineering projects focused on concurrency, persistence, and quality automation.',
        '',
        ...(missing.length
            ? [
                '<!-- REVIEW BEFORE SENDING — Areas not claimed and excluded from this draft:',
                ...missing.map((m) => `- ${m}`),
                '-->',
                '',
            ]
            : []),
        'Thank you for your time and consideration.',
        '',
        'Sincerely,',
        data.profile.name,
        `${data.profile.location} | ${data.profile.contact.email}`,
        data.profile.contact.linkedin,
        '',
    ].join('\n');
}

function renderInterviewPrepMarkdown(data, vacancy, matchResult) {
    const gaps = [
        ...matchResult.classifications.Familiarity,
        ...matchResult.classifications['Missing evidence'],
        ...matchResult.classifications['Requires confirmation'],
    ];

    return [
        `# Interview Preparation — ${vacancy.jobTitle} at ${vacancy.company}`,
        '',
        '## 1. NDA & Generic-Framing Guardrails',
        '- **CRITICAL:** Describe engineering problems at Kuehne+Nagel, Taxify (Bolt), and Oracle strictly in terms of generic architectural patterns and personal responsibilities.',
        '- Never disclose internal project names, internal service topologies, proprietary algorithms, customer data, internal endpoints, or unpublished production metrics.',
        '- When asked for deep technical specifics on concurrency or idempotency, walk through public implementations such as `stden/EntityLocker` or personal projects instead.',
        '',
        '## 2. Priority Technical Topics',
        '- Java 6–25 evolution, JVM internals, Java Memory Model (`volatile`, happens-before, `ReentrantLock`, `ConcurrentHashMap`).',
        '- Spring Boot dependency injection, transaction boundaries (`@Transactional`), connection pooling, and JPA/Hibernate N+1 & lazy-loading pitfalls.',
        '- Distributed reliability: at-least-once delivery vs exactly-once semantics, transactional outbox limitations, idempotency keys & TTLs, dead-letter queues.',
        '- PostgreSQL indexing, MVCC isolation levels, and `SELECT ... FOR UPDATE SKIP LOCKED` row-level locking semantics.',
        '',
        '## 3. Gaps & Areas Requiring Preparation',
        ...(gaps.length
            ? gaps.map((g) => `- **${g.requirement}:** ${g.evidence}`)
            : ['- Review deep-dive specifics for every core skill listed in the vacancy.']),
        '',
        '## 4. Questions Likely Based on the Vacancy & Your CV',
        `- Walk through how you design idempotent consumers for ${vacancy.company}'s asynchronous workloads when duplicate broker deliveries occur.`,
        '- At Oracle JDK SQE, what kinds of Java Memory Model or class-loading defects did you investigate, and how did you isolate flaky concurrency failures?',
        '- In `EntityLocker`, why does `ConcurrentHashMap.remove(ID)` create an eviction race under contention, and how would `compute()` + `AtomicInteger` fix it?',
        '- How does transitioning from Node.js/TypeScript high-load APIs at Taxify (Bolt) to enterprise Java/Spring Boot at Kuehne+Nagel inform your testing and reliability practices?',
        '',
        '## 5. Practice Exercises (System Design, Java Concurrency, SQL & Messaging)',
        '- **System Design:** Design a resilient webhook/event ingestion pipeline with transactional outbox, at-least-once delivery, consumer deduplication, and DLQ handling.',
        '- **Java Concurrency:** Implement thread-safe per-key locking with timeout, reentrancy, and atomic map eviction without leaking lock objects.',
        '- **SQL & Messaging:** Write a `FOR UPDATE SKIP LOCKED` worker claim query with lease timeouts so crashed workers do not leave rows stuck in `PROCESSING`.',
        '',
        '## 6. Behavioural Questions & Verified STAR Story Outlines',
        '- **Production incident investigation (Kuehne+Nagel — keep NDA-generic):** *Situation:* Production integration service failing intermittently under load. *Task:* Isolate root cause without leaking customer data. *Action:* Correlated logs, database lock/transaction boundaries, and retry policies; added automated regression tests. *Result:* Restored stability and improved test coverage (state only verified, non-confidential facts).',
        '- **Stabilising flaky concurrent tests (Oracle):** *Situation:* Multi-platform JDK concurrency test suites exhibiting timing-sensitive failures. *Task:* Improve signal reliability. *Action:* Analysed thread interleavings, JMM visibility, and distributed execution scripts in Java/Python. *Result:* More deterministic test diagnostics across environments.',
        '- **High-load API iteration (Taxify / Bolt):** *Situation:* High-throughput REST microservice endpoints requiring predictable behaviour. *Task:* Maintain and extend API endpoints safely. *Action:* Applied containerised testing, Redis caching awareness, and disciplined API validation.',
        '',
        '## 7. Suggested Questions for the Engineering Manager',
        '- How does the team structure service ownership, on-call rotation, and post-incident reviews?',
        '- Which delivery guarantees (at-least-once + idempotency, outbox, DLQ tooling) are most critical in this team’s architecture?',
        '- What does strong engineering impact look like during the first 90 days?',
        '',
    ].join('\n');
}

function renderRecruiterQuestionsMarkdown(vacancy, matchResult) {
    const confirmItems = matchResult.classifications['Requires confirmation'];
    return [
        `# Questions for Recruiter — ${vacancy.jobTitle} (${vacancy.company})`,
        '',
        '## Role & Team Scope',
        `- Is this role focused primarily on new service development, legacy modernisation, or cross-system integration at ${vacancy.company}?`,
        '- What is the team size, engineering seniority mix, and product domain?',
        '',
        '## Technical Stack & Architecture',
        '- Which Java LTS version, Spring Boot version, and messaging/database technologies are used in daily production?',
        '- How mature are CI/CD pipelines, automated integration tests, and observability tooling?',
        '',
        '## Process, Language & Logistics',
        ...(confirmItems.length
            ? confirmItems.map((c) => `- **Confirm:** ${c.requirement} (${c.evidence})`)
            : []),
        '- What are the interview stages (coding, system design, behavioural) and expected timeline?',
        '- What is the hybrid/remote expectation, working language, and compensation band for this level?',
        '',
    ].join('\n');
}

module.exports = {
    prepareJobCv,
    renderCoverLetterMarkdown,
    renderInterviewPrepMarkdown,
    renderMatchReportMarkdown,
    renderRecruiterQuestionsMarkdown,
};
