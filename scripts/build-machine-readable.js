const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');

function loadProjectVerification(verificationPath = path.join(ROOT_DIR, '.build', 'github-project-verification.json')) {
    try {
        return JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

function slugifyProject(name) {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function metaEnvelope(data) {
    const baseUrl = data.site.baseUrl.replace(/\/+$/, '');
    const meta = data.meta || {};
    return {
        schemaVersion: String(meta.schemaVersion || '1.0.0'),
        canonicalProfileUrl: `${baseUrl}/`,
        contentRevisionDate: String(meta.contentRevisionDate || '2026-11-27'),
        canonicalLanguage: String(meta.canonicalLanguage || 'en'),
    };
}

function allowlistedLinks(baseUrl) {
    return {
        htmlProfile: `${baseUrl}/`,
        llmsTxt: `${baseUrl}/llms.txt`,
        resumeMarkdown: `${baseUrl}/resume.md`,
        resumeText: `${baseUrl}/resume.txt`,
        candidateJson: `${baseUrl}/candidate.json`,
        skillsEvidenceJson: `${baseUrl}/skills-evidence.json`,
        roleAlignmentJson: `${baseUrl}/role-alignment.json`,
        roleAlignmentHtml: `${baseUrl}/roles/`,
        articlesHtml: `${baseUrl}/articles/`,
        sitemapXml: `${baseUrl}/sitemap.xml`,
    };
}

function buildCandidateProfile(data, verification = loadProjectVerification()) {
    const envelope = metaEnvelope(data);
    const baseUrl = envelope.canonicalProfileUrl.replace(/\/$/, '');
    const { profile } = data;
    const contact = profile.contact || {};

    const identity = {
        name: String(profile.name),
        title: String(profile.title),
        location: String(profile.location),
        summary: String(profile.summary),
        coreTopics: [...(profile.coreBadges || [])],
        canonicalPdf: `${baseUrl}/assets/pdf/Denis-Stepulenok-CV-EN.pdf`,
        links: {
            portfolio: `${baseUrl}/`,
            github: String(contact.github),
            linkedin: String(contact.linkedin),
            telegram: String(contact.telegram),
            email: `mailto:${contact.email}`,
        },
        openToWorkDisclosed: Boolean(profile.availability?.showOpenToWork),
    };
    if (profile.availability?.showOpenToWork && profile.availability?.statusText) {
        identity.availabilityStatus = String(profile.availability.statusText);
    }

    const employmentHistory = (data.experience || []).map((role) => ({
        id: String(role.id),
        company: String(role.company),
        role: String(role.role),
        period: String(role.period),
        location: String(role.location),
        summary: String(role.summary),
        responsibilities: [...(role.responsibilities || [])],
        primaryTechnologies: [...(role.projectTechnologies || [])],
        additionalTechnologies: [...(role.additionalTechnologies || [])],
        verificationStatus: 'self-reported',
        evidenceNote: 'Employer experience is self-reported; private employer systems and metrics are covered by NDA and not publicly inspectable.',
    }));

    const publicProjects = (data.githubProjects || []).map((project) => {
        const record = verification[project.name] || {};
        return {
            id: slugifyProject(project.name),
            name: String(project.name),
            url: String(project.url),
            language: String(project.language),
            description: String(project.description),
            topics: [...(project.topics || [])],
            verificationStatus: record.ciStatus === 'Passing' ? 'ci-verified' : 'publicly-inspectable',
            ciStatus: String(record.ciStatus || 'Not verified'),
            ciUrl: record.ciUrl ? String(record.ciUrl) : null,
            lastVerifiedDate: String(record.verifiedAt || envelope.contentRevisionDate),
            latestActivityDate: record.latestActivity ? String(record.latestActivity) : null,
        };
    });

    const caseStudies = (data.caseStudies || [])
        .filter((item) => ['independent-personal', 'authorised-open-source', 'independent-educational'].includes(item.provenance?.kind))
        .map((item) => ({
            id: String(item.id),
            title: String(item.title),
            url: `${baseUrl}/projects/#case-${item.id}`,
            provenanceKind: String(item.provenance.kind),
            provenanceSummary: String(item.provenance.summary),
            sourceUrl: item.provenance.sourceUrl ? String(item.provenance.sourceUrl) : null,
            summary: String(item.problem || item.context || ''),
            stack: [...(item.stack || [])],
        }));

    const articles = (data.articles || []).map((article) => ({
        id: String(article.slug),
        title: String(article.title),
        url: `${baseUrl}/articles/${article.slug}/`,
        publishedDate: String(article.publishedDate),
        updatedDate: String(article.updatedDate),
        author: String(article.author),
        topics: [...(article.topics || [])],
        summary: String(article.summary),
    }));

    return {
        ...envelope,
        profilePolicy: 'Public allowlisted candidate summary. Excludes private application history, unapproved metrics, and confidential employer details.',
        identity,
        languages: (data.languages || []).map((lang) => ({
            name: String(lang.name),
            level: String(lang.level),
        })),
        education: (data.education || []).map((edu, index) => ({
            id: `education-${index + 1}`,
            degree: String(edu.degree),
            institution: String(edu.institution),
            period: String(edu.period),
        })),
        employmentHistory,
        publicProjects,
        caseStudies,
        articles,
        machineReadableFormats: allowlistedLinks(baseUrl),
        availableLocales: ['en', 'et', 'de', 'ru'],
    };
}

function buildSkillsEvidence(data) {
    const envelope = metaEnvelope(data);
    const skills = [];

    for (const group of data.skills || []) {
        for (const item of group.items || []) {
            skills.push({
                id: String(item.id),
                name: String(item.name),
                synonyms: [...(item.synonyms || [])],
                groupId: String(group.id),
                groupTitle: String(group.title),
                tier: String(item.tier),
                experienceCategory: String(item.experienceCategory),
                context: String(item.context),
                supportingUrls: [...(item.supportingUrls || [])],
                evidenceType: String(item.evidenceType),
                verificationStatus: String(item.verificationStatus),
                lastVerificationDate: String(item.lastVerificationDate || envelope.contentRevisionDate),
                limitations: String(item.limitations),
            });
        }
    }

    return {
        ...envelope,
        verificationLegend: {
            'self-reported': 'Experience reported by the candidate from private commercial employment; cannot be independently verified from public source code.',
            'publicly-inspectable': 'Supported by public source code or technical documentation on GitHub/portfolio without an automated CI workflow.',
            'ci-verified': 'Supported by a public GitHub repository with an inspected passing automated CI workflow.',
            'requires-confirmation': 'Listed familiarity or breadth item without dedicated public repository or detailed production evidence.',
        },
        skillsCount: skills.length,
        skills,
    };
}

function buildRoleAlignment(data) {
    const envelope = metaEnvelope(data);
    const baseUrl = envelope.canonicalProfileUrl.replace(/\/$/, '');
    return {
        ...envelope,
        pageUrl: `${baseUrl}/roles/`,
        disclaimer: 'Role alignment maps confirmed skills and public repositories to target engineering roles. It is separate from employment history and deliberately omits synthetic fit scores or offer probabilities.',
        roles: (data.roleAlignment || []).map((role) => ({
            id: String(role.id),
            title: String(role.title),
            summary: String(role.summary),
            relevantCompetencies: (role.relevantCompetencies || []).map((comp) => ({
                id: String(comp.id),
                name: String(comp.name),
            })),
            supportingEvidence: (role.supportingEvidence || []).map((ev) => ({
                kind: String(ev.kind),
                ref: String(ev.ref),
                label: String(ev.label),
                verificationStatus: String(ev.verificationStatus),
            })),
            limitations: String(role.limitations),
            areasRequiringConfirmation: [...(role.areasRequiringConfirmation || [])],
        })),
    };
}

function buildResumeMarkdown(data) {
    const candidate = buildCandidateProfile(data);
    const skillsEvidence = buildSkillsEvidence(data);
    const lines = [
        `# ${candidate.identity.name}`,
        '',
        `**${candidate.identity.title}**  `,
        `Location: ${candidate.identity.location}  `,
        `Portfolio: ${candidate.canonicalProfileUrl}  `,
        `Email: ${data.profile.contact.email} | GitHub: ${candidate.identity.links.github} | LinkedIn: ${candidate.identity.links.linkedin}  `,
        `PDF Resume: ${candidate.identity.canonicalPdf}  `,
        `Revision Date: ${candidate.contentRevisionDate} (Canonical English)`,
        '',
        '## Professional Summary',
        '',
        candidate.identity.summary,
        '',
        '## Technical Skills & Verification Context',
        '',
        '> Note: Employer production experience is self-reported under NDA; only linked GitHub repositories can be inspected publicly.',
        '',
    ];

    const byCategory = [
        ['primary-professional', 'Primary Professional'],
        ['additional-professional', 'Additional Professional'],
        ['independent-engineering', 'Independent Engineering'],
        ['familiarity', 'Listed Familiarity (Requires Confirmation)'],
    ];
    for (const [category, heading] of byCategory) {
        const items = skillsEvidence.skills.filter((s) => s.experienceCategory === category);
        if (!items.length) continue;
        lines.push(`- **${heading}:** ${items.map((s) => `${s.name} (${s.verificationStatus})`).join('; ')}`);
    }

    lines.push('', '## Professional Experience', '');
    for (const role of candidate.employmentHistory) {
        lines.push(`### ${role.role} — ${role.company}`);
        lines.push(`${role.period} · ${role.location} *(Verification: ${role.verificationStatus})*`);
        lines.push('');
        lines.push(role.summary);
        for (const bullet of role.responsibilities) {
            lines.push(`- ${bullet}`);
        }
        lines.push(`- Technologies: ${[...role.primaryTechnologies, ...role.additionalTechnologies].join(', ')}`);
        lines.push('');
    }

    lines.push('## Selected Public Repositories', '');
    for (const repo of candidate.publicProjects) {
        lines.push(`- **[${repo.name}](${repo.url})** (${repo.language}, ${repo.verificationStatus}): ${repo.description}`);
    }

    lines.push('', '## Education & Languages', '');
    for (const edu of candidate.education) {
        lines.push(`- **${edu.degree}**, ${edu.institution} (${edu.period})`);
    }
    lines.push(`- **Languages:** ${candidate.languages.map((l) => `${l.name} (${l.level})`).join(', ')}`);
    lines.push('');
    lines.push('## Machine-Readable Formats', '');
    lines.push(`- Candidate JSON: ${candidate.machineReadableFormats.candidateJson}`);
    lines.push(`- Skills Evidence JSON: ${candidate.machineReadableFormats.skillsEvidenceJson}`);
    lines.push(`- Role Alignment JSON: ${candidate.machineReadableFormats.roleAlignmentJson}`);
    lines.push(`- Plain Text Resume: ${candidate.machineReadableFormats.resumeText}`);
    lines.push('');

    return lines.join('\n');
}

function buildResumeText(data) {
    const candidate = buildCandidateProfile(data);
    const skillsEvidence = buildSkillsEvidence(data);
    const lines = [
        candidate.identity.name.toUpperCase(),
        candidate.identity.title,
        `Location: ${candidate.identity.location}`,
        `Portfolio: ${candidate.canonicalProfileUrl}`,
        `Email: ${data.profile.contact.email}`,
        `GitHub: ${candidate.identity.links.github}`,
        `LinkedIn: ${candidate.identity.links.linkedin}`,
        `Canonical PDF: ${candidate.identity.canonicalPdf}`,
        `Content Revision Date: ${candidate.contentRevisionDate}`,
        '',
        'SUMMARY',
        '-------',
        candidate.identity.summary,
        '',
        'SKILLS & EVIDENCE TIERS',
        '-----------------------',
    ];

    for (const [category, heading] of [
        ['primary-professional', 'Primary professional'],
        ['additional-professional', 'Additional professional'],
        ['independent-engineering', 'Independent engineering'],
        ['familiarity', 'Familiarity (requires confirmation)'],
    ]) {
        const items = skillsEvidence.skills.filter((s) => s.experienceCategory === category);
        if (items.length) {
            lines.push(`${heading}: ${items.map((s) => s.name).join(', ')}`);
        }
    }

    lines.push('', 'EXPERIENCE (SELF-REPORTED)', '--------------------------');
    for (const role of candidate.employmentHistory) {
        lines.push(`${role.role} | ${role.company} | ${role.period} | ${role.location}`);
        lines.push(role.summary);
        for (const bullet of role.responsibilities) {
            lines.push(`  * ${bullet}`);
        }
        lines.push(`  Technologies: ${[...role.primaryTechnologies, ...role.additionalTechnologies].join(', ')}`);
        lines.push('');
    }

    lines.push('PUBLIC REPOSITORIES (INSPECTABLE)', '---------------------------------');
    for (const repo of candidate.publicProjects) {
        lines.push(`* ${repo.name} (${repo.language}, ${repo.verificationStatus}): ${repo.url}`);
        lines.push(`  ${repo.description}`);
    }

    lines.push('', 'EDUCATION & LANGUAGES', '---------------------');
    for (const edu of candidate.education) {
        lines.push(`* ${edu.degree} — ${edu.institution} (${edu.period})`);
    }
    lines.push(`* Languages: ${candidate.languages.map((l) => `${l.name}: ${l.level}`).join('; ')}`);
    lines.push('');
    return lines.join('\n');
}

function buildLlmsTxt(data) {
    const candidate = buildCandidateProfile(data);
    const links = candidate.machineReadableFormats;
    return [
        `# ${candidate.identity.name}`,
        '',
        `> ${candidate.identity.title} in ${candidate.identity.location}. Canonical English portfolio and structured CV profile (${candidate.canonicalProfileUrl}), last revised ${candidate.contentRevisionDate}.`,
        '',
        'Employer experience entries are self-reported under NDA; public GitHub repositories are linked separately for independent inspection.',
        '',
        '## Primary Profile & Resumes',
        '',
        `- [Canonical Portfolio (English)](${links.htmlProfile}): Recruiter-first HTML overview, Schema.org metadata, and PDF download`,
        `- [Markdown Resume](${links.resumeMarkdown}): Clean English resume in Markdown`,
        `- [Plain Text Resume](${links.resumeText}): Plain-text ATS/crawler-friendly resume`,
        `- [Canonical PDF Resume](${candidate.identity.canonicalPdf}): Printable A4 English PDF`,
        `- [All CV Variants](${candidate.canonicalProfileUrl}cv/): Targeted web and PDF profiles`,
        '',
        '## Machine-Readable JSON Exports',
        '',
        `- [Candidate Profile JSON](${links.candidateJson}): Allowlisted identity, employment history, education, and public repositories (schema v${candidate.schemaVersion})`,
        `- [Skills Evidence JSON](${links.skillsEvidenceJson}): Skill inventory with synonyms, context, verification status, supporting URLs, and limitations`,
        `- [Role Alignment JSON](${links.roleAlignmentJson}): Structured role mapping across six target engineering roles with confirmation notes and zero synthetic scores`,
        '',
        '## Evidence, Roles & Technical Articles',
        '',
        `- [Experience Details](${candidate.canonicalProfileUrl}experience/): Full chronological timeline, education, and languages`,
        `- [Skills & Verification](${candidate.canonicalProfileUrl}skills/): Skills grouped by evidence tier`,
        `- [Public Projects](${candidate.canonicalProfileUrl}projects/): Independent case studies and six verified GitHub repositories`,
        `- [Role Alignment](${links.roleAlignmentHtml}): Target role competencies, public evidence, and confirmation questions`,
        `- [Technical Articles](${links.articlesHtml}): Independently researched notes on Java locking, Kafka idempotency/outbox, PostgreSQL row locking, Rust/MCP, and CI verification`,
        '',
        '## Verified Public Repositories',
        '',
        ...candidate.publicProjects.map((repo) =>
            `- [${repo.name}](${repo.url}): ${repo.language} (${repo.verificationStatus}) — ${repo.description}`),
        '',
    ].join('\n');
}

function writeMachineReadableFiles(rootDir = ROOT_DIR) {
    const data = loadCvData();
    const verification = loadProjectVerification(path.join(rootDir, '.build', 'github-project-verification.json'));
    const candidate = buildCandidateProfile(data, verification);
    const skillsEvidence = buildSkillsEvidence(data);
    const roleAlignment = buildRoleAlignment(data);

    const outputs = [
        ['candidate.json', `${JSON.stringify(candidate, null, 2)}\n`],
        ['skills-evidence.json', `${JSON.stringify(skillsEvidence, null, 2)}\n`],
        ['role-alignment.json', `${JSON.stringify(roleAlignment, null, 2)}\n`],
        ['resume.md', buildResumeMarkdown(data)],
        ['resume.txt', buildResumeText(data)],
        ['llms.txt', buildLlmsTxt(data)],
    ];

    for (const [filename, content] of outputs) {
        fs.writeFileSync(path.join(rootDir, filename), content, 'utf8');
    }
    return outputs.map(([filename]) => filename);
}

if (require.main === module) {
    const written = writeMachineReadableFiles();
    console.log(`Generated ${written.length} machine-readable profile artifacts.`);
}

module.exports = {
    loadProjectVerification,
    buildCandidateProfile,
    buildSkillsEvidence,
    buildRoleAlignment,
    buildResumeMarkdown,
    buildResumeText,
    buildLlmsTxt,
    writeMachineReadableFiles,
};
