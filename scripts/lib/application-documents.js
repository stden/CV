const { relevance } = require('./vacancy-match');

function md(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim()
        .replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])
        .replace(/[\\`*_{}\[\]()!#|~]/g, '\\$&');
}

function bullets(items) {
    return items.map((item) => `- ${item}`).join('\n');
}

function context(vacancy) {
    const role = md(vacancy.title) || 'the advertised role';
    return vacancy.company ? `${role} at ${md(vacancy.company)}` : role;
}

function relevantRoles(data, terms) {
    return data.experience.filter(({ compact, responsibilities }) => !compact && responsibilities.length)
        .map((role) => ({ role, score: relevance(role.responsibilities.join(' '), terms) }))
        .sort((left, right) => right.score - left.score).slice(0, 3).map(({ role }) => role);
}

function renderMatchReport(vacancy, match) {
    const entries = match.map(({ category, requirement, status, reason, evidence }) => [
        `### ${md(requirement)}`,
        '',
        `**${category} · ${status}**`,
        '',
        reason,
        '',
        bullets(evidence.map(({ source, detail }) => `**${md(source)}** · ${md(detail)}`)),
    ].join('\n'));
    return [
        '# Vacancy matching',
        '',
        `**${context(vacancy)}**`,
        '',
        vacancy.location && `Location listed in the vacancy · ${md(vacancy.location)}`,
        '',
        'Each assessment uses the verified CV source. Confirm any missing evidence or assumptions before sending an application.',
        '',
        ...(entries.length
            ? entries.flatMap((entry) => [entry, ''])
            : ['The vacancy has no explicit requirement list. Add required technologies and competencies to vacancy.json to enable matching.', '']),
    ].filter((line) => line !== false).join('\n');
}

function renderCoverLetter(data, variant, vacancy, roles) {
    const selectedProject = data.caseStudies.find(({ id }) => id === variant.caseStudyIds[0]);
    return `# Cover letter

Dear ${vacancy.company ? `${md(vacancy.company)} hiring team` : 'hiring team'},

I am applying for ${context(vacancy)}. ${md(variant.summary)}

My experience includes the following work.

${bullets(roles.slice(0, 2).map((role) => `**${md(role.company)}** · ${md(role.responsibilities[0])}`))}

${selectedProject ? `In independent engineering, my work includes **${md(selectedProject.title)}**. ${md(selectedProject.problem)}\n\n` : ''}I would welcome the opportunity to discuss how these experiences apply to your team's engineering priorities.

Best regards,

${md(data.profile.name)}
`;
}

const practicePrompts = {
    java: 'How would you structure and test a Java backend change before deploying it?',
    jvm: 'Which evidence distinguishes a JVM performance problem from an application-level bottleneck?',
    'spring boot': 'How would you test a Spring Boot service at its database and messaging boundaries?',
    postgresql: 'What would lead you to change a PostgreSQL query, index or transaction boundary?',
    'enterprise integration': 'How would you evolve an integration contract when consumers upgrade at different times?',
    'distributed systems': 'What can fail across services, and how would you observe, contain and recover from it?',
    'asynchronous messaging': 'What prevents duplicate side effects after a retry, and when should the consumer acknowledge the message?',
    'apache kafka': 'What do partitions, consumer groups and offset commits imply for ordering and retries?',
    concurrency: 'How would you test thread safety and separate correctness from throughput?',
    'automated testing': 'Which behaviours need unit tests, integration tests and production checks?',
    reliability: 'How would you find a reliability problem and prove that a proposed fix addresses it?',
    'large language models': 'How would you evaluate quality, cost and failure cases before deploying an LLM-based feature?',
};

function renderInterview(data, variant, vacancy, match, roles, terms) {
    const strengths = match.filter(({ status }) => status === 'Strong evidence')
        .map(({ requirement }) => md(requirement));
    const gaps = match.filter(({ status }) => status !== 'Strong evidence')
        .map(({ requirement, status }) => `**${status}** · ${md(requirement)}`);
    const vacancyQuestions = [...new Set(match
        .map(({ requirement, terms: keys }) => keys.map((key) => practicePrompts[key]).find(Boolean)
            || `What evidence would you use to discuss “${md(requirement)}” in the interview?`))]
        .slice(0, 8);
    const cvQuestions = roles.map(({ company, responsibilities }) =>
        `At ${md(company)}, what trade-off did you consider in this work? **CV evidence** · ${md(responsibilities[0])}`);
    const stories = roles.map((role) => [
        `### ${md(role.company)} · ${md(role.role)}`,
        '',
        `- **Situation** · ${md(role.summary)}`,
        '- **Task** · Describe your own responsibility at a general level and distinguish it from the team’s work.',
        `- **Action** · Use this verified CV example. ${md(role.responsibilities[0])}`,
        '- **Result** · Add a verified qualitative outcome or an approved metric. Confirm the result before citing it.',
    ].join('\n'));
    const project = data.caseStudies.find(({ id }) => id === variant.caseStudyIds[0]);
    if (project) {
        const action = project.decisions[0] || project.architecture;
        const result = Array.isArray(project.results) ? project.results.join(' ') : project.results;
        stories.push(`### ${md(project.title)} · independent project\n\n- **Situation** · ${md(project.problem)}\n- **Task** · Explain the project’s goal and the trade-offs you set.\n- **Action** · ${md(action)}\n- **Result** · ${result ? md(result) : 'Add an outcome you can demonstrate from the project.'}`);
    }
    const technicalTopics = [
        ...strengths.slice(0, 5),
        ...(terms.some((term) => ['asynchronous messaging', 'rabbitmq', 'apache kafka'].includes(term))
            ? ['Message acknowledgement, deduplication, retry policy and failure isolation']
            : ['Service boundaries, error handling, and backward-compatible changes']),
        'Java thread safety and the Java Memory Model',
        'SQL indexes, transactions and isolation',
    ];
    return `# Interview preparation

**${context(vacancy)}**

## Technical topics

${bullets(technicalTopics)}

## Questions based on the vacancy

${bullets(vacancyQuestions.length ? vacancyQuestions : ['Which systems and outcomes are most important during the first months in this role?'])}

## Questions based on your CV

${bullets(cvQuestions)}

## Areas to prepare or confirm

${bullets(gaps.length ? gaps : ['Prepare a verified example for each priority requirement and explain its scope.'])}

## Practice exercises

- **System design** · Design a fictional asynchronous ingestion pipeline. Define an API, a retry strategy, idempotency keys, data ownership and operational failure handling. Explain trade-offs without relying on an employer’s design.
- **Java concurrency** · Implement a thread-safe per-key counter. Compare a lock with \`ConcurrentHashMap.compute\` and explain visibility, contention and how you would test concurrent updates.
- **SQL** · Design a schema for fictional events. Write a deduplication query and discuss a unique constraint, an index and transaction isolation.
- **Messaging** · Explain how at-least-once delivery affects a consumer. Show how acknowledgement after durable processing changes retry behaviour.
- **Behavioural** · Prepare examples of resolving ambiguity, deciding between reliability and delivery speed, and explaining a trade-off to a stakeholder.

## STAR story outlines

${stories.join('\n\n')}

## Questions for the engineering manager

- What are the main reliability or delivery challenges for this team?
- What would success in the first 90 days look like?
- How are design decisions reviewed, and how does the team share production responsibility?

## Discuss employer work in general terms

Use a fictional scenario for detailed architecture discussion. Describe responsibilities, trade-offs and public technologies. Keep internal system names, customer information, implementation details and non-public outcomes out of the interview.
`;
}

function renderRecruiterQuestions(vacancy, match) {
    const gaps = match.filter(({ status }) => status === 'Requires confirmation');
    const questions = [
        vacancy.location ? `The listing names ${md(vacancy.location)}. What is the office and hybrid-working policy?` : 'Where is the role based, and what is the office or remote-work policy?',
        vacancy.employmentType ? `The listing describes the role as ${md(vacancy.employmentType)}. Can you confirm the contract and expected start date?` : 'What are the contract type and expected start date?',
        vacancy.salaryRange ? 'How is the published compensation range structured, including any bonus or equity?' : 'What compensation range is budgeted for the role?',
        vacancy.applicationDeadline ? `The posted deadline is ${md(vacancy.applicationDeadline)}. What is the expected decision timeline?` : 'What is the expected interview timeline?',
        'What are the interview stages and who takes part in each?',
        ...gaps.slice(0, 4).map(({ requirement }) => `How will you assess the requirement “${md(requirement)}”?`),
    ];
    return `# Questions for the recruiter

**${context(vacancy)}**

${bullets(questions)}

## Questions for the engineering manager

- Which engineering outcomes would you prioritise in the first quarter?
- How does the team approach production ownership, incident learning and design review?
- Which parts of the stack or problem domain need prior experience, and which can be learned after joining?
`;
}

function renderApplicationDocuments(data, variant, vacancy, match) {
    const terms = [...new Set(match.filter(({ status }) => status !== 'Familiarity').flatMap((entry) => entry.terms))];
    const roles = relevantRoles(data, terms);
    return {
        'cover-letter.md': renderCoverLetter(data, variant, vacancy, roles),
        'match-report.md': renderMatchReport(vacancy, match),
        'interview-preparation.md': renderInterview(data, variant, vacancy, match, roles, terms),
        'questions-for-recruiter.md': renderRecruiterQuestions(vacancy, match),
    };
}

module.exports = { renderApplicationDocuments };
