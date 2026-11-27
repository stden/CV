const assert = require('node:assert/strict');
const test = require('node:test');
const { cv, variants } = require('../src/cv-data');
const { renderResume } = require('../src/resume');
const { prepareJobCv } = require('../src/job-cv');

const specification = {
    slug: 'example-java-backend-1234',
    source: 'https://careers.example.org/jobs/1234',
    profile: 'java-backend',
    summary: 'Java backend engineer with Spring Boot and asynchronous message processing experience.',
    skills: ['spring-boot', 'java', 'rabbitmq', 'postgresql'],
    projects: ['xml-transformation-pipeline', 'document-link-gateway'],
};

test('a targeted CV selects only requested catalogue entries and keeps the employment history', () => {
    const { cv: tailored, variant } = prepareJobCv(specification);
    assert.deepEqual(tailored.experience, cv.experience);
    assert.deepEqual(tailored.skills.flatMap(({ entries }) => entries.map(({ id }) => id)),
        ['spring-boot', 'java', 'postgresql', 'rabbitmq']);
    assert.deepEqual(variant.projects, specification.projects);
    assert.equal(variant.title, 'Senior Java Backend Engineer');
    assert.equal(variant.filename, 'Denis-Stepulenok-example-java-backend-1234.pdf');
    const html = renderResume(tailored, variant, { stylesheet: '/* private stylesheet */' });
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(html, /<style>\/\* private stylesheet \*\/<\/style>/);
    assert.match(html, /href="Denis-Stepulenok-example-java-backend-1234.pdf" download/);
    assert.doesNotMatch(html, /rel="canonical"/);
});

test('a tailored spec rejects unknown experience signals and unsafe output names', () => {
    assert.throws(() => prepareJobCv({ ...specification, skills: ['unverified-skill'] }), /Unknown skill/);
    assert.throws(() => prepareJobCv({ ...specification, projects: ['unverified-project'] }), /Unknown project/);
    assert.throws(() => prepareJobCv({ ...specification, slug: '../dist' }), /slug/);
    assert.throws(() => prepareJobCv({ ...specification, source: 'javascript:alert(1)' }), /HTTPS/);
});

test('the general resume gives experience precedence over the skills inventory', () => {
    const html = renderResume(cv, variants.find(({ slug }) => slug === 'general'));
    assert.ok(html.indexOf('id="experience"') < html.indexOf('id="skills"'));
    assert.doesNotMatch(html, /Weaviate|Go\*|Apache Kafka/);
});
