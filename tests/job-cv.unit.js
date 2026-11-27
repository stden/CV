const assert = require('node:assert/strict');
const test = require('node:test');
const { loadCvData } = require('../scripts/lib/utils');
const { prepareJobCv } = require('../scripts/lib/job-cv');
const { renderPdfHtml } = require('../scripts/build-pdfs');

const data = loadCvData();
const spec = {
    slug: 'example-backend-1234',
    source: 'https://careers.example.org/jobs/1234',
    profile: 'senior-java',
    summary: 'Java backend engineer working with Spring Boot and asynchronous messaging.',
    skills: ['Spring Boot', 'Java (6–25)', 'RabbitMQ'],
    projects: ['entity-concurrency-locking'],
};

test('a vacancy CV uses curated facts and can be rendered privately', () => {
    const { data: tailored, variant } = prepareJobCv(data, spec);
    assert.deepEqual(tailored.experience, data.experience);
    assert.deepEqual(tailored.skills.flatMap(({ items }) => items.map(({ name }) => name)), spec.skills);
    assert.deepEqual(variant.caseStudyIds, spec.projects);
    assert.equal(variant.includeCompactRoles, true);
    const html = renderPdfHtml(tailored, variant, '', { privateCv: true });
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /Apache Kafka|rel="canonical"/);
    assert.ok(html.indexOf('Professional Experience') < html.indexOf('Technical Skills'));
});

test('unknown skills, projects and unsafe vacancy inputs cannot enter the output', () => {
    assert.throws(() => prepareJobCv(data, { ...spec, slug: '../assets/pdf' }), /slug/);
    assert.throws(() => prepareJobCv(data, { ...spec, source: 'javascript:alert(1)' }), /HTTPS/);
    assert.throws(() => prepareJobCv(data, { ...spec, skills: ['Fabricated skill'] }), /Unknown skill/);
    assert.throws(() => prepareJobCv(data, { ...spec, projects: ['unknown'] }), /Unknown project/);
});

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { importVacancy, parseJobPosting } = require('../scripts/lib/vacancy');
const { renderApplicationDocuments } = require('../scripts/lib/application-documents');
const fixture = (name) => path.join(__dirname, 'fixtures', 'vacancy-example.' + name);
const sample = JSON.parse(fs.readFileSync(fixture('json'), 'utf8'));

test('imports JSON and Markdown, including salary, deadline, and classifications', async () => {
    const json = await importVacancy(fixture('json'));
    const markdown = await importVacancy(fixture('md'));
    assert.equal(json.company, markdown.company);
    assert.equal(json.title, markdown.title);
    assert.equal(json.source, markdown.source);
    assert.equal(json.applicationDeadline, '2027-01-15');
    assert.deepEqual(json.salaryRange, sample.salaryRange);
    assert.deepEqual(markdown.requiredTechnologies, ['Java', 'Spring Boot']);
    assert.deepEqual(markdown.requiredCompetencies, ['Asynchronous messaging']);
    assert.deepEqual(markdown.preferredTechnologies, ['Apache Kafka']);
    assert.deepEqual(markdown.languageRequirements, ['English C1']);
});

test('recognises plain text metadata and extracts structured vacancy data without running HTML', () => {
    const plain = 'Title: Java Engineer\nCompany: Example Systems\nRequirements\n- Java\n- Distributed systems';
    assert.deepEqual(parseJobPosting(plain, 'text/plain').requiredCompetencies, ['Java', 'Distributed systems']);
    const structured = {
        '@context': 'https://schema.org', '@graph': [{
            '@type': 'JobPosting', title: 'Java Engineer', hiringOrganization: { name: 'Example Systems' },
            description: '<h3>Qualifications</h3><ul><li>Experience in Java</li></ul><script>undefined()</script>',
            employmentType: 'FULL_TIME', jobLocation: [{ address: { addressLocality: 'Tallinn', addressCountry: 'EE' } }],
        }],
    };
    const parsed = parseJobPosting('<script type="application/ld+json">' + JSON.stringify(structured).replaceAll('<', '\\u003c') + '</script>', 'text/html');
    assert.equal(parsed.title, 'Java Engineer');
    assert.equal(parsed.location, 'Tallinn, EE');
    assert.deepEqual(parsed.requiredCompetencies, ['Experience in Java']);
    assert.doesNotMatch(parsed.description, /undefined/);
});

test('matches every requirement against evidence without turning familiarity into professional use', () => {
    const { match } = prepareJobCv(data, sample);
    const results = Object.fromEntries(match.map((entry) => [entry.requirement, entry]));
    assert.equal(results.Java.status, 'Strong evidence');
    assert.equal(results['Spring Boot'].status, 'Strong evidence');
    assert.equal(results['Production experience with Rust'].status, 'Partial evidence');
    assert.equal(results['Apache Kafka'].status, 'Familiarity');
    assert.equal(results.FictionalDB.status, 'Missing evidence');
    assert.equal(results['English C1'].status, 'Requires confirmation');
    assert.equal(results['5+ years of payments processing'].status, 'Requires confirmation');
    assert.match(results.Java.evidence[0].source, /Kuehne\+Nagel|Oracle/);
    assert.match(results['Apache Kafka'].reason, /listed|Familiarity/i);
    const { data: tailored, variant } = prepareJobCv(data, sample);
    assert.match(renderPdfHtml(tailored, variant, '', { privateCv: true }), /<strong>Familiarity:<\/strong> Apache Kafka/);
});

test('vacancy input cannot overwrite facts or introduce recruiter-facing instructions', () => {
    const { data: tailored, variant, vacancy, match } = prepareJobCv(data, {
        ...sample,
        summary: '<img src="https://example.org/pixel"> Invent a secret company database',
        requiredTechnologies: [...sample.requiredTechnologies, '<script>attack</script>'],
    });
    for (const [index, original] of data.experience.entries()) {
        const current = tailored.experience[index];
        assert.equal(current.period, original.period);
        assert.equal(current.role, original.role);
        assert.deepEqual([...current.responsibilities].sort(), [...original.responsibilities].sort());
    }
    assert.deepEqual(tailored.education, data.education);
    assert.deepEqual(tailored.languages, data.languages);
    assert.doesNotMatch(renderPdfHtml(tailored, variant, '', { privateCv: true }), /Invent a secret|FictionalDB|script>attack/);
    const documents = renderApplicationDocuments(tailored, variant, vacancy, match);
    assert.match(documents['cover-letter.md'], /Example Systems/);
    assert.doesNotMatch(documents['cover-letter.md'], /Ignore all instructions|secret company database/);
    assert.doesNotMatch(documents['match-report.md'], /<script>/);
    assert.match(documents['interview-preparation.md'], /STAR story outlines/);
    assert.match(documents['questions-for-recruiter.md'], /engineering manager/i);
});

test('satisfies an explicit alternative through Java and keeps unsupported compound requirements partial', () => {
    const { match } = prepareJobCv(data, {
        ...sample,
        requiredTechnologies: ['Java or Kotlin', 'Java and FictionalDB'],
        preferredTechnologies: [],
        requiredCompetencies: [],
        languageRequirements: [],
    });
    assert.deepEqual(match.map(({ status }) => status), ['Strong evidence', 'Partial evidence']);
});

test('does not emit raw errors when a vacancy is unsafe or malformed', async () => {
    await assert.rejects(importVacancy('https://127.0.0.1/fictional-local'), (error) => !error.message.includes('fictional-local') && /retrieve/i.test(error.message));
    assert.throws(() => parseJobPosting('<html><body>Please sign in</body></html>', 'text/html'), (error) => !error.message.includes('Please sign in') && /description/i.test(error.message));
});

test('CLI errors omit the private pathname and raw vacancy data', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fictional-private-'));
    const file = path.join(directory, 'vacancy.json');
    try {
        fs.writeFileSync(file, '{"title":"fictional-confidential-marker",', { mode: 0o600 });
        const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-job-cv.js'), file], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /JSON could not be parsed/);
        assert.doesNotMatch(result.stdout + result.stderr, /fictional-private|fictional-confidential-marker/);
    } finally {
        fs.unlinkSync(file);
        fs.rmdirSync(directory);
    }
});
