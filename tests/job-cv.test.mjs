import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from '../scripts/lib/content.mjs';
import { prepareJobCv } from '../scripts/lib/job-cv.mjs';
import { renderCvPage } from '../scripts/render/cv-page.mjs';

const content = loadContent();
const specification = {
  slug: 'example-backend-1234',
  source: 'https://careers.example.org/jobs/1234',
  profile: 'senior-java-backend',
  summary: 'Java backend engineer working with Spring Boot and asynchronous messaging.',
  skills: ['Spring Boot', 'Java', 'RabbitMQ'],
  projects: ['xml-transformation-pipeline'],
  focus: ['messaging', 'integration']
};

test('private CVs use the catalogue, preserve the roles and render without a public route', () => {
  const { content: tailored, variant } = prepareJobCv(content, specification);
  assert.deepEqual(tailored.cv.experience, content.cv.experience);
  assert.deepEqual(tailored.cv.earlierExperience, content.cv.earlierExperience);
  assert.deepEqual(tailored.cv.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name)), specification.skills);
  assert.deepEqual(variant.projects, specification.projects);
  assert.deepEqual(variant.focus, specification.focus);
  assert.equal(variant.title, 'Senior Java Backend Engineer');
  const html = renderCvPage(tailored, variant, { stylesheet: '/* local CSS */' });
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<style>\/\* local CSS \*\/<\/style>/);
  assert.match(html, /href="Denis-Stepulenok-example-backend-1234.pdf" download/);
  assert.doesNotMatch(html, /rel="canonical"|Apache Kafka|Selected projects[^<]*Weaviate/);
});

test('vacancy inputs reject unknown references and unsafe destinations', () => {
  assert.throws(() => prepareJobCv(content, { ...specification, slug: '../public' }), /slug/);
  assert.throws(() => prepareJobCv(content, { ...specification, source: 'javascript:alert(1)' }), /HTTPS/);
  assert.throws(() => prepareJobCv(content, { ...specification, skills: ['Fabricated skill'] }), /Unknown skill/);
  assert.throws(() => prepareJobCv(content, { ...specification, projects: ['missing-project'] }), /Unknown project/);
  assert.throws(() => prepareJobCv(content, { ...specification, focus: ['made-up-tag'] }), /Unknown focus tag/);
});

test('the general CV presents professional experience ahead of skills', () => {
  const variant = content.variants.find(({ slug }) => slug === 'general');
  const html = renderCvPage(content, variant);
  assert.ok(html.indexOf('id="experience-title"') < html.indexOf('id="skills-title"'));
});
