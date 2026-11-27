import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../scripts/lib/content.mjs';
import { validateContent } from '../scripts/lib/validate.mjs';

const content = loadContent();
const clone = () => structuredClone(content);

test('the shipped content passes validation', () => {
  assert.deepEqual(validateContent(content), []);
});

test('skill percentages are rejected', () => {
  const broken = clone();
  broken.cv.skillGroups[0].title = 'Java 97%';
  assert.ok(validateContent(broken).some((error) => error.includes('percentages')));
});

test('a variant that references an unknown project is rejected', () => {
  const broken = clone();
  broken.variants[0].projects.push('does-not-exist');
  assert.ok(validateContent(broken).some((error) => error.includes('unknown project does-not-exist')));
});

test('duplicate experience ids are rejected', () => {
  const broken = clone();
  broken.cv.experience[1].id = broken.cv.experience[0].id;
  assert.ok(validateContent(broken).some((error) => error.startsWith('duplicate id')));
});

test('every architecture diagram belongs to a project and uses known concepts', () => {
  const projectIds = new Set(content.cv.projects.map((project) => project.id));
  for (const diagram of content.architecture.diagrams) {
    assert.ok(projectIds.has(diagram.id), `${diagram.id} has no project`);
  }
  const conceptIds = new Set(content.architecture.concepts.map((concept) => concept.id));
  for (const diagram of content.architecture.diagrams) {
    for (const id of diagram.concepts) assert.ok(conceptIds.has(id), `unknown concept ${id}`);
  }
});

test('Kafka is not presented as professional experience until it is confirmed', () => {
  const kafka = content.cv.skillGroups.flatMap((group) => group.skills).find((skill) => skill.name === 'Apache Kafka');
  assert.notEqual(kafka?.evidence, 'professional');
});

test('Kuehne+Nagel is the first role and is featured', () => {
  const [first] = content.cv.experience;
  assert.equal(first.organisation, 'Kuehne+Nagel');
  assert.equal(first.featured, true);
  assert.match(first.period, /Present$/);
});

test('the Taxify entry says it is now Bolt', () => {
  const taxify = content.cv.experience.find((job) => job.id === 'taxify');
  assert.equal(taxify.organisation, 'Taxify (now Bolt)');
});

test('the professional title matches the requested positioning', () => {
  assert.equal(content.cv.headline, 'Senior Software Engineer | Java, Distributed Systems & AI Engineering');
});

test('open-to-work is off by default', () => {
  assert.equal(content.site.availability.showOpenToWork, false);
});

test('every variant has a PDF name in the agreed format', () => {
  for (const variant of content.variants) {
    assert.match(variant.pdf, /^Denis-Stepulenok-[A-Za-z-]+\.pdf$/, variant.pdf);
  }
});

test('the 14 technology logos used by the technology pages exist', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { repoRoot } = await import('../scripts/lib/content.mjs');
  const withLogo = ['java', 'spring', 'spring-boot', 'postgresql', 'angular', 'react', 'maven', 'hibernate', 'jenkins', 'docker', 'kubernetes', 'git', 'gitlab', 'python'];
  for (const slug of withLogo) {
    assert.ok(existsSync(join(repoRoot, 'assets/images/tech', `${slug}.svg`)), `missing logo for ${slug}`);
  }
});

test('diagram labels fit inside their boxes in the SVG (at most 46 characters)', () => {
  for (const diagram of content.architecture.diagrams) {
    for (const component of diagram.components) {
      assert.ok(component.detail.length <= 46, `${diagram.id}: "${component.detail}" is too long for its box`);
    }
  }
});
