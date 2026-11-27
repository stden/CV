const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadCvData } = require('../scripts/lib/utils');
const { prepareJobCv } = require('../scripts/lib/job-cv');
const { matchVacancy, parseMarkdownVacancy } = require('../scripts/lib/vacancy-matcher');
const { buildJobCv } = require('../scripts/build-job-cv');
const { renderPdfHtml } = require('../scripts/build-pdfs');

const data = loadCvData();
const legacySpec = {
    slug: 'example-backend-1234',
    source: 'https://www.linkedin.com/jobs/view/1234',
    profile: 'senior-java',
    summary: 'Java backend engineer working with Spring Boot and asynchronous messaging.',
    skills: ['Spring Boot', 'Java (6–25)', 'RabbitMQ'],
    projects: ['entity-concurrency-locking'],
};

const syntheticVacancy = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'synthetic-vacancy.json'), 'utf8')
);

test('a legacy vacancy CV uses curated facts and can be rendered privately', () => {
    const { data: tailored, variant } = prepareJobCv(data, legacySpec);
    assert.deepEqual(tailored.experience, data.experience);
    assert.deepEqual(tailored.skills.flatMap(({ items }) => items.map(({ name }) => name)), legacySpec.skills);
    assert.deepEqual(variant.caseStudyIds, legacySpec.projects);
    assert.equal(variant.includeCompactRoles, true);
    const html = renderPdfHtml(tailored, variant, '', { privateCv: true });
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /Terraform|rel="canonical"/);
    assert.ok(html.indexOf('Professional Experience') < html.indexOf('Technical Skills'));
});

test('unknown skills, projects and unsafe vacancy inputs cannot enter the output', () => {
    assert.throws(() => prepareJobCv(data, { ...legacySpec, slug: '../assets/pdf' }), /slug/);
    assert.throws(() => prepareJobCv(data, { ...legacySpec, source: 'javascript:alert(1)' }), /HTTPS/);
    assert.throws(() => prepareJobCv(data, { ...legacySpec, skills: ['Fabricated skill'] }), /Unknown skill/);
    assert.throws(() => prepareJobCv(data, { ...legacySpec, projects: ['unknown'] }), /Unknown project/);
});

test('vacancy matcher classifies evidence honestly without speculative scores', () => {
    const { classifications } = matchVacancy(data, syntheticVacancy);
    assert.ok(classifications['Strong evidence'].some((i) => i.requirement === 'Java'));
    assert.ok(classifications['Strong evidence'].some((i) => i.requirement === 'Spring Boot'));
    assert.ok(classifications['Strong evidence'].some((i) => i.requirement === 'Apache Kafka'));
    assert.ok(classifications['Partial evidence'].some((i) => i.requirement === 'Kubernetes'));
    assert.ok(classifications.Familiarity.some((i) => i.requirement === 'Terraform'));
    assert.ok(classifications['Missing evidence'].some((i) => /Payment processing|AML/i.test(i.requirement)));
    assert.ok(classifications['Requires confirmation'].some((i) => /Language requirement/i.test(i.requirement)));
});

test('rich vacancy tailoring preserves factual dates, titles, companies, and language levels', () => {
    const { data: tailored } = prepareJobCv(data, syntheticVacancy);
    assert.equal(tailored.experience.length, data.experience.length);
    for (let i = 0; i < data.experience.length; i++) {
        assert.equal(tailored.experience[i].company, data.experience[i].company);
        assert.equal(tailored.experience[i].role, data.experience[i].role);
        assert.equal(tailored.experience[i].period, data.experience[i].period);
    }
    assert.deepEqual(tailored.languages, data.languages);
    assert.deepEqual(tailored.education, data.education);
});

test('markdown vacancy parser extracts fields safely', () => {
    const md = `---
Company: Synthetic Cloud GmbH
Job Title: Senior Distributed Systems Engineer
URL: https://www.linkedin.com/jobs/view/777888
Required Technologies: Java, PostgreSQL, RabbitMQ
Language Requirements: English C1
---
Build backend integration pipelines in Java and PostgreSQL.`;
    const parsed = parseMarkdownVacancy(md);
    assert.equal(parsed.company, 'Synthetic Cloud GmbH');
    assert.equal(parsed.jobTitle, 'Senior Distributed Systems Engineer');
    assert.deepEqual(parsed.requiredTechnologies, ['Java', 'PostgreSQL', 'RabbitMQ']);
    assert.equal(parsed.languageRequirements, 'English C1');
});

test('buildJobCv creates all 7 private application package files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-app-pkg-'));
    try {
        await buildJobCv([
            path.join(__dirname, 'fixtures', 'synthetic-vacancy.json'),
            '--out-dir',
            tmpDir,
        ]);
        for (const expected of [
            'resume.pdf',
            'resume.html',
            'cover-letter.md',
            'vacancy.json',
            'match-report.md',
            'interview-preparation.md',
            'questions-for-recruiter.md',
        ]) {
            const p = path.join(tmpDir, expected);
            assert.ok(fs.existsSync(p), `Missing application package file: ${expected}`);
            assert.ok(fs.statSync(p).size > 0, `Empty application package file: ${expected}`);
        }
        const matchReport = fs.readFileSync(path.join(tmpDir, 'match-report.md'), 'utf8');
        assert.match(matchReport, /## Missing evidence/);
        assert.doesNotMatch(matchReport, /\b\d{1,3}%\s*match\b/i);
        const interviewPrep = fs.readFileSync(path.join(tmpDir, 'interview-preparation.md'), 'utf8');
        assert.match(interviewPrep, /NDA & Generic-Framing Guardrails/);
        assert.match(interviewPrep, /STAR Story Outlines/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
