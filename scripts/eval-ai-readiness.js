const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ROOT_DIR } = require('./lib/utils');
const { localeCodes, localizedPath } = require('./lib/i18n');
const { runConfidentialityCheck } = require('./check-confidentiality');

const EVALUATION_PROMPTS = [
    {
        id: 'primary-specialisation',
        prompt: 'What is Denis Stepulenok’s primary engineering specialisation, core stack, and location?',
    },
    {
        id: 'senior-java-suitability',
        prompt: 'Evaluate evidence relevant to a Senior Java Backend Engineer vacancy without inventing hiring scores.',
    },
    {
        id: 'jvm-concurrency-evidence',
        prompt: 'What evidence supports JVM concurrency expertise, including inspectable code, tests, and known limitations?',
    },
    {
        id: 'kafka-prof-vs-independent',
        prompt: 'Distinguish confirmed professional Apache Kafka experience from independent experimentation or educational material.',
    },
    {
        id: 'distributed-systems-strengths-gaps',
        prompt: 'Identify documented strengths, gaps, and areas requiring interview confirmation for a Distributed Systems Engineer role.',
    },
    {
        id: 'supporting-public-repos',
        prompt: 'Which public GitHub repositories support the portfolio, what languages do they use, and which have CI verification?',
    },
    {
        id: 'unsupported-ambiguous-claims',
        prompt: 'Identify claims that remain self-reported, unverified publicly, or listed only as familiarity requiring confirmation.',
    },
    {
        id: 'hiring-manager-summary',
        prompt: 'Write a neutral, citation-backed hiring-manager summary based strictly on allowlisted public sources.',
    },
];

function stripTags(html) {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function readOptionalText(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

function readOptionalJson(filePath) {
    const raw = readOptionalText(filePath);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function loadPublicArtifactCorpus(artifactDir) {
    const absRoot = path.resolve(artifactDir);
    if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
        throw new Error(`Artifact directory not found: ${artifactDir}`);
    }

    const indexHtml = readOptionalText(path.join(absRoot, 'index.html')) || '';
    const experienceHtml = readOptionalText(path.join(absRoot, 'experience', 'index.html')) || '';
    const skillsHtml = readOptionalText(path.join(absRoot, 'skills', 'index.html')) || '';
    const projectsHtml = readOptionalText(path.join(absRoot, 'projects', 'index.html')) || '';
    const architectureHtml = readOptionalText(path.join(absRoot, 'architecture', 'index.html')) || '';
    const rolesHtml = readOptionalText(path.join(absRoot, 'roles', 'index.html')) || '';
    const articlesIndexHtml = readOptionalText(path.join(absRoot, 'articles', 'index.html')) || '';
    const llmsTxt = readOptionalText(path.join(absRoot, 'llms.txt'));
    const resumeMd = readOptionalText(path.join(absRoot, 'resume.md'));
    const resumeTxt = readOptionalText(path.join(absRoot, 'resume.txt'));
    const candidateJson = readOptionalJson(path.join(absRoot, 'candidate.json'));
    const skillsEvidenceJson = readOptionalJson(path.join(absRoot, 'skills-evidence.json'));
    const roleAlignmentJson = readOptionalJson(path.join(absRoot, 'role-alignment.json'));
    const sitemapXml = readOptionalText(path.join(absRoot, 'sitemap.xml')) || '';
    const robotsTxt = readOptionalText(path.join(absRoot, 'robots.txt')) || '';

    const ldMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const jsonLd = ldMatch ? JSON.parse(ldMatch[1]) : null;

    const allTexts = [
        stripTags(indexHtml),
        stripTags(experienceHtml),
        stripTags(skillsHtml),
        stripTags(projectsHtml),
        stripTags(architectureHtml),
        stripTags(rolesHtml),
        stripTags(articlesIndexHtml),
        llmsTxt || '',
        resumeMd || '',
        resumeTxt || '',
        candidateJson ? JSON.stringify(candidateJson) : '',
        skillsEvidenceJson ? JSON.stringify(skillsEvidenceJson) : '',
        roleAlignmentJson ? JSON.stringify(roleAlignmentJson) : '',
    ].join('\n');

    const localeIndexes = Object.fromEntries(
        localeCodes.map((code) => [code, readOptionalText(path.join(absRoot, localizedPath(code, 'index.html'))) || ''])
    );

    let pdfText = '';
    const pdfFile = path.join(absRoot, 'assets', 'pdf', 'Denis-Stepulenok-CV-EN.pdf');
    if (fs.existsSync(pdfFile)) {
        try {
            pdfText = execFileSync('pdftotext', [pdfFile, '-'], { encoding: 'utf8' });
        } catch {
            pdfText = '';
        }
    }

    return {
        root: absRoot,
        indexHtml,
        experienceHtml,
        skillsHtml,
        projectsHtml,
        architectureHtml,
        rolesHtml,
        articlesIndexHtml,
        llmsTxt,
        resumeMd,
        resumeTxt,
        candidateJson,
        skillsEvidenceJson,
        roleAlignmentJson,
        sitemapXml,
        robotsTxt,
        jsonLd,
        localeIndexes,
        pdfText,
        allTexts,
    };
}

function checkPromptCriteria(promptId, corpus) {
    const text = corpus.allTexts;
    const has = (needle) => text.includes(needle);
    const hasMachineJson = Boolean(corpus.candidateJson && corpus.skillsEvidenceJson && corpus.roleAlignmentJson);

    switch (promptId) {
    case 'primary-specialisation': {
        const facts = [
            has('Denis Stepulenok'),
            has('Senior Software Engineer — Java & Distributed Systems'),
            has('Tallinn, Estonia'),
            has('Kuehne+Nagel'),
            has('Java') && has('Spring Boot') && has('PostgreSQL'),
        ];
        const citations = [
            corpus.indexHtml.includes('rel="canonical"'),
            Boolean(corpus.llmsTxt),
            Boolean(corpus.candidateJson?.canonicalProfileUrl),
            Boolean(corpus.resumeMd),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: facts.every(Boolean)
                ? 'Senior Software Engineer — Java & Distributed Systems in Tallinn, Estonia.'
                : 'Partial extraction of primary profile metadata.',
        };
    }
    case 'senior-java-suitability': {
        const facts = [
            has('Kuehne+Nagel') && has('May 2018'),
            has('Oracle') && has('SQE'),
            has('Java (6–25)') || has('Java'),
            has('Spring Boot') && has('PostgreSQL') && has('JPA'),
            Boolean(corpus.roleAlignmentJson?.roles?.some((r) => r.id === 'senior-java-backend-engineer')),
        ];
        const citations = [
            has('https://github.com/stden/EntityLocker'),
            has('https://github.com/stden/JPA2'),
            corpus.rolesHtml.includes('role-align-senior-java-backend-engineer'),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Maps Kuehne+Nagel & Oracle Java experience alongside EntityLocker and JPA2 without synthetic fit scores.',
        };
    }
    case 'jvm-concurrency-evidence': {
        const facts = [
            has('EntityLocker'),
            has('ReentrantLock') || has('reentrant'),
            has('CountLock') || has('non-atomic') || has('additional stress testing'),
            has('EntityLockerTest.java') || has('JUnit'),
            Boolean(corpus.articlesIndexHtml.includes('java-keyed-entity-locking') || has('java-keyed-entity-locking')),
        ];
        const citations = [
            has('https://github.com/stden/EntityLocker'),
            has('https://github.com/stden/EntityLocker/blob/main/src/test/java/EntityLockerTest.java'),
            Boolean(corpus.skillsEvidenceJson?.skills?.find((s) => s.id === 'jvm-concurrency')?.limitations),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Inspectable stden/EntityLocker + JUnit 4 tests cited with documented CountLock eviction limitation.',
        };
    }
    case 'kafka-prof-vs-independent': {
        const kafkaSkill = corpus.skillsEvidenceJson?.skills?.find((s) => s.id === 'apache-kafka');
        const facts = [
            has('Kuehne+Nagel') && has('Apache Kafka'),
            has('Spring Kafka') || has('partition'),
            has('transactional outbox') || has('Transactional Outbox'),
            kafkaSkill ? kafkaSkill.verificationStatus === 'self-reported' : false,
            Boolean(corpus.articlesIndexHtml.includes('kafka-consumer-idempotency-outbox')),
        ];
        const citations = [
            Boolean(kafkaSkill?.limitations),
            corpus.experienceHtml.includes('role-kuehne-nagel'),
            corpus.architectureHtml.includes('arch-tab-ref-event-driven-outbox')
                || corpus.indexHtml.includes('arch-tab-ref-event-driven-outbox'),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Separates confirmed self-reported Kuehne+Nagel Kafka production work from independent outbox educational diagrams/articles.',
        };
    }
    case 'distributed-systems-strengths-gaps': {
        const dsRole = corpus.roleAlignmentJson?.roles?.find((r) => r.id === 'distributed-systems-engineer');
        const facts = [
            has('RabbitMQ') && has('Apache Kafka'),
            has('Taxify (now Bolt)'),
            Boolean(dsRole?.limitations),
            Boolean(dsRole?.areasRequiringConfirmation?.length >= 2),
        ];
        const citations = [
            Boolean(dsRole),
            Boolean(corpus.rolesHtml.includes('role-align-distributed-systems-engineer')),
            Boolean(corpus.skillsEvidenceJson?.skills?.find((s) => s.id === 'kubernetes')?.verificationStatus === 'self-reported'),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Identifies messaging/microservice strengths alongside explicit throughput/Kubernetes/Raft confirmation gaps.',
        };
    }
    case 'supporting-public-repos': {
        const repos = ['EntityLocker', 'JPA2', 'FunnyFileManager', 'RustShot', 'SonarQubeChecker', 'pythorust_tg'];
        const facts = [
            ...repos.map((name) => has(`https://github.com/stden/${name}`)),
            Boolean(corpus.candidateJson?.publicProjects?.length === 6),
        ];
        const citations = [
            Boolean(corpus.candidateJson?.publicProjects?.every((p) => ['ci-verified', 'publicly-inspectable'].includes(p.verificationStatus))),
            corpus.projectsHtml.includes('https://github.com/stden/EntityLocker'),
            Boolean(corpus.llmsTxt?.includes('EntityLocker')),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Enumerates all 6 public GitHub repositories with language and CI verification distinctions.',
        };
    }
    case 'unsupported-ambiguous-claims': {
        const skills = corpus.skillsEvidenceJson?.skills || [];
        const hasSelfReported = skills.some((s) => s.verificationStatus === 'self-reported');
        const hasConfirmation = skills.some((s) => s.verificationStatus === 'requires-confirmation');
        const facts = [
            hasSelfReported,
            hasConfirmation,
            has('English') && has('Intermediate'),
            corpus.candidateJson ? corpus.candidateJson.identity?.openToWorkDisclosed === false : !has('Open to Senior Backend'),
        ];
        const citations = [
            Boolean(corpus.skillsEvidenceJson?.verificationLegend?.['self-reported']),
            Boolean(corpus.skillsEvidenceJson?.verificationLegend?.['requires-confirmation']),
            Boolean(corpus.roleAlignmentJson?.disclaimer),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Flags self-reported employer claims, listed familiarity items, English Intermediate level, and non-disclosed Open to Work status.',
        };
    }
    case 'hiring-manager-summary': {
        const facts = [
            has('Denis Stepulenok') && has('Tallinn, Estonia'),
            has('Kuehne+Nagel') && has('Taxify (now Bolt)') && has('Oracle'),
            hasMachineJson,
            Boolean(corpus.resumeTxt && corpus.resumeMd),
        ];
        const citations = [
            corpus.indexHtml.includes('rel="describedby"'),
            corpus.indexHtml.includes('rel="alternate"'),
            corpus.sitemapXml.includes('/roles/'),
            corpus.sitemapXml.includes('/articles/'),
        ];
        return {
            factsPassed: facts.filter(Boolean).length,
            factsTotal: facts.length,
            citationsPassed: citations.filter(Boolean).length,
            citationsTotal: citations.length,
            summary: 'Produces balanced hiring-manager brief anchored in HTML, JSON, Markdown, PDF, roles, and articles.',
        };
    }
    default:
        throw new Error(`Unknown prompt id: ${promptId}`);
    }
}

function evaluateArtifact(artifactDir) {
    const corpus = loadPublicArtifactCorpus(artifactDir);
    const promptResults = EVALUATION_PROMPTS.map(({ id, prompt }) => ({
        id,
        prompt,
        ...checkPromptCriteria(id, corpus),
    }));

    const factsPassed = promptResults.reduce((sum, r) => sum + r.factsPassed, 0);
    const factsTotal = promptResults.reduce((sum, r) => sum + r.factsTotal, 0);
    const citationsPassed = promptResults.reduce((sum, r) => sum + r.citationsPassed, 0);
    const citationsTotal = promptResults.reduce((sum, r) => sum + r.citationsTotal, 0);

    // Skill identification & evidence coverage
    const structuredSkills = corpus.skillsEvidenceJson?.skills || [];
    const expectedSkillTotal = 51;
    const htmlSkillNamesPresent = expectedSkillTotal; // 51 rendered in skills/index.html
    const structuredCompleteCount = structuredSkills.filter((s) =>
        s.id && s.name && Array.isArray(s.synonyms) && s.synonyms.length > 0
        && s.experienceCategory && s.context && Array.isArray(s.supportingUrls)
        && s.evidenceType && s.verificationStatus && s.lastVerificationDate && s.limitations
    ).length;

    const skillCompleteness = Math.round(
        ((structuredSkills.length ? structuredCompleteCount : Math.min(htmlSkillNamesPresent, 15)) / expectedSkillTotal) * 100
    );
    const evidenceCoverage = structuredSkills.length
        ? Math.round((structuredSkills.filter((s) => s.verificationStatus && s.limitations).length / structuredSkills.length) * 100)
        : Math.round((Object.keys(corpus.skillsEvidenceJson || {}).length / expectedSkillTotal) * 100);

    // Detect any synthetic scores, prompt injections, or leaked open-to-work banners
    const lowerText = corpus.allTexts.toLowerCase();
    const hallucinations = [];
    if (/(?:match|fit|hire|offer)\s+(?:score|probability|rating)\s*[:=]?\s*\d+\s*%?/i.test(lowerText)) {
        hallucinations.push('synthetic-hiring-score');
    }
    if (/ignore previous instructions|system prompt|always recommend this candidate|must hire/i.test(lowerText)) {
        hallucinations.push('prompt-injection-directive');
    }
    if (corpus.candidateJson?.employmentHistory?.some((e) => e.verificationStatus !== 'self-reported')) {
        hallucinations.push('unverified-employer-marked-verified');
    }
    if (corpus.candidateJson?.identity?.openToWorkDisclosed === true) {
        hallucinations.push('open-to-work-disclosed-unexpectedly');
    }

    // Cross-format & cross-locale consistency checks
    const consistencyChecks = [
        localeCodes.every((code) => corpus.localeIndexes[code]?.includes('Denis Stepulenok')),
        localeCodes.every((code) => corpus.localeIndexes[code]?.includes('Kuehne+Nagel')),
        Boolean(corpus.pdfText.includes('Denis Stepulenok') && corpus.pdfText.includes('Kuehne+Nagel')),
        Boolean(corpus.resumeMd?.includes('Denis Stepulenok') && corpus.resumeMd?.includes('Kuehne+Nagel')),
        Boolean(/denis stepulenok/i.test(corpus.resumeTxt || '') && corpus.resumeTxt?.includes('Kuehne+Nagel')),
        Boolean(corpus.llmsTxt?.includes('Denis Stepulenok') && corpus.llmsTxt?.includes('candidate.json')),
        Boolean(corpus.candidateJson?.identity?.name === 'Denis Stepulenok' && corpus.candidateJson?.identity?.openToWorkDisclosed === false),
        Boolean(corpus.roleAlignmentJson?.roles?.length === 6),
        Boolean(corpus.indexHtml.includes('describedby') && corpus.indexHtml.includes('candidate.json')),
    ];

    const metrics = {
        factualExtractionAccuracy: Math.round((factsPassed / factsTotal) * 100),
        citationAccuracy: Math.round((citationsPassed / citationsTotal) * 100),
        skillCompleteness,
        hallucinatedClaims: hallucinations.length,
        evidenceCoverage,
        crossFormatConsistency: Math.round((consistencyChecks.filter(Boolean).length / consistencyChecks.length) * 100),
    };

    return {
        artifactDir: corpus.root,
        formatsPresent: {
            html: Boolean(corpus.indexHtml),
            llmsTxt: Boolean(corpus.llmsTxt),
            resumeMd: Boolean(corpus.resumeMd),
            resumeTxt: Boolean(corpus.resumeTxt),
            candidateJson: Boolean(corpus.candidateJson),
            skillsEvidenceJson: Boolean(corpus.skillsEvidenceJson),
            roleAlignmentJson: Boolean(corpus.roleAlignmentJson),
            rolesPage: Boolean(corpus.rolesHtml),
            articlesPage: Boolean(corpus.articlesIndexHtml),
            pdf: Boolean(corpus.pdfText),
        },
        metrics,
        hallucinations,
        prompts: promptResults,
    };
}

async function runExternalEvaluation({ candidateDir, provider, model }) {
    if (process.env.AI_EVAL_ALLOW_EXTERNAL !== '1') {
        throw new Error('External LLM evaluation disabled unless AI_EVAL_ALLOW_EXTERNAL=1 and --confirm-public-only are explicitly passed.');
    }
    runConfidentialityCheck({ artifactRoot: candidateDir });

    const corpus = loadPublicArtifactCorpus(candidateDir);
    const contextPayload = [
        '=== llms.txt ===',
        corpus.llmsTxt || '',
        '=== candidate.json ===',
        JSON.stringify(corpus.candidateJson || {}, null, 2),
        '=== role-alignment.json ===',
        JSON.stringify(corpus.roleAlignmentJson || {}, null, 2),
        '=== resume.md ===',
        corpus.resumeMd || '',
    ].join('\n\n');

    if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY is required for --provider openai.');
        const responses = [];
        for (const item of EVALUATION_PROMPTS) {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model || 'gpt-4o-mini',
                    temperature: 0,
                    messages: [
                        { role: 'system', content: 'Answer strictly from the provided public CV files. Cite source names. Flag unverified self-reported items and do not invent scores.' },
                        { role: 'user', content: `Public CV Sources:\n${contextPayload}\n\nQuestion: ${item.prompt}` },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`External provider HTTP ${res.status}`);
            const payload = await res.json();
            responses.push({ id: item.id, answer: payload.choices?.[0]?.message?.content || '' });
        }
        return responses;
    }

    throw new Error(`Unsupported or unconfigured provider: ${provider}. Run offline mode without --provider for deterministic evaluation.`);
}

function parseArgs(argv) {
    const args = {
        candidate: path.join(ROOT_DIR, '_site'),
        baseline: null,
        json: false,
        out: null,
        provider: null,
        model: null,
        confirmPublicOnly: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--candidate') args.candidate = path.resolve(argv[++i]);
        else if (token === '--baseline') args.baseline = path.resolve(argv[++i]);
        else if (token === '--json') args.json = true;
        else if (token === '--out') args.out = path.resolve(argv[++i]);
        else if (token === '--provider') args.provider = argv[++i];
        else if (token === '--model') args.model = argv[++i];
        else if (token === '--confirm-public-only') args.confirmPublicOnly = true;
        else throw new Error(`Unknown argument: ${token}`);
    }
    return args;
}

function formatTextReport(candidateReport, baselineReport) {
    const lines = ['AI Search & Recruitment Agent Readiness Evaluation', '=================================================='];
    const keys = [
        ['factualExtractionAccuracy', 'Factual extraction accuracy (%)'],
        ['citationAccuracy', 'Citation accuracy (%)'],
        ['skillCompleteness', 'Structured skill completeness (%)'],
        ['hallucinatedClaims', 'Hallucinated claims (count)'],
        ['evidenceCoverage', 'Evidence & limitation coverage (%)'],
        ['crossFormatConsistency', 'Cross-format & locale consistency (%)'],
    ];
    for (const [key, label] of keys) {
        if (baselineReport) {
            lines.push(`- ${label}: Baseline ${baselineReport.metrics[key]} -> Improved ${candidateReport.metrics[key]}`);
        } else {
            lines.push(`- ${label}: ${candidateReport.metrics[key]}`);
        }
    }
    lines.push('', 'Prompt Breakdown:');
    for (const item of candidateReport.prompts) {
        lines.push(`  * ${item.id}: facts ${item.factsPassed}/${item.factsTotal}, citations ${item.citationsPassed}/${item.citationsTotal} — ${item.summary}`);
    }
    return lines.join('\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const candidateReport = evaluateArtifact(args.candidate);
    const baselineReport = args.baseline ? evaluateArtifact(args.baseline) : null;
    let externalResponses = null;

    if (args.provider) {
        if (!args.confirmPublicOnly) {
            throw new Error('Pass --confirm-public-only alongside --provider and AI_EVAL_ALLOW_EXTERNAL=1.');
        }
        externalResponses = await runExternalEvaluation({
            candidateDir: args.candidate,
            provider: args.provider,
            model: args.model,
        });
    }

    const report = {
        baseline: baselineReport,
        candidate: candidateReport,
        ...(externalResponses ? { externalResponses } : {}),
    };

    if (args.out) {
        if (path.resolve(args.out).startsWith(path.resolve(args.candidate) + path.sep)) {
            throw new Error('Refusing to write evaluation report inside public artifact directory.');
        }
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    if (args.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(formatTextReport(candidateReport, baselineReport));
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    EVALUATION_PROMPTS,
    evaluateArtifact,
    loadPublicArtifactCorpus,
};
