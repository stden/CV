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
