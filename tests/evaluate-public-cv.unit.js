const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    PROMPTS, readCorpus, evaluate, compare,
} = require('../scripts/lib/public-cv-evaluation');

const baseUrl = 'https://example.invalid/CV/';
const page = (content, language = 'en') => `<!doctype html><html lang="${language}"><body><main>${content}</main></body></html>`;
const fixture = () => ({ baseUrl, allowed: ['index.html', 'experience/index.html', 'candidate.json', 'de/index.html'] });

function artifacts(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-eval-fixture-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'experience'));
    fs.mkdirSync(path.join(root, 'de'));
    fs.mkdirSync(path.join(root, 'applications'));
    fs.writeFileSync(path.join(root, 'index.html'), page('<p>Java backend services and distributed systems.</p><script>Kafka is independently verified.</script>'));
    fs.writeFileSync(path.join(root, 'experience/index.html'), page('<p>Fictional employment in Java development.</p>'));
    fs.writeFileSync(path.join(root, 'de/index.html'), page('<p>Verteilte Systeme</p>', 'de'));
    fs.writeFileSync(path.join(root, 'candidate.json'), JSON.stringify({ professionalTitle: 'Java backend development and distributed systems' }));
    fs.writeFileSync(path.join(root, 'applications', 'resume.html'), page('<p>Fictional private applicant</p>'));
    return root;
}

test('publishes eight neutral prompts and parses only visible allowlisted public documents', (t) => {
    assert.equal(PROMPTS.length, 8);
    assert.equal(new Set(PROMPTS.map(({ id }) => id)).size, 8);
    const corpus = readCorpus(artifacts(t), fixture());
    assert.deepEqual([...corpus.documents.keys()].sort(), fixture().allowed.sort());
    assert.doesNotMatch(corpus.documents.get('index.html').text, /independently verified/);
    assert.equal(corpus.documents.get('de/index.html').language, 'de');
});

test('offline control reports factual coverage on both snapshots without pretending to be a model', (t) => {
    const baseline = artifacts(t);
    const improved = artifacts(t);
    fs.writeFileSync(path.join(improved, 'experience/index.html'), page('<p>Oracle JDK concurrency and automated Java tests.</p>'));
    const result = compare(readCorpus(baseline, fixture()), readCorpus(improved, fixture()));
    assert.equal(result.mode, 'offline-control');
    assert.equal(result.measures.baseline.hallucinatedClaims, null);
    assert.ok(result.measures.improved.factualExtraction.numerator > result.measures.baseline.factualExtraction.numerator);
    assert.equal(result.measures.improved.citationAccuracy.numerator, result.measures.improved.citationAccuracy.denominator);
    assert.ok(result.measures.improved.formatConsistency.formats.json.available);
});

test('recorded answers separate contradictions, uncategorized statements, and unsupported citations', (t) => {
    const corpus = readCorpus(artifacts(t), fixture());
    const answers = Object.fromEntries(PROMPTS.map(({ id }) => [id, []]));
    answers.specialisation.push(
        { id: 'java-backend', value: 'Java backend development', citations: [{ source: 'index.html', quote: 'Java backend services and distributed systems.' }] },
        { id: 'distributed-systems', value: 'Distributed systems engineering', citations: [{ source: 'https://example.invalid/CV/index.html', quote: 'This quote does not exist.' }] },
        { id: 'not-in-rubric', value: 'A statement outside the rubric', citations: [] },
    );
    answers.ambiguous.push({
        id: 'kafka-verification-limit', value: 'Kafka is independently verified by the employer.', citations: [],
    });
    const result = evaluate(corpus, answers);
    assert.equal(result.hallucinatedClaims, 1);
    assert.equal(result.uncategorizedClaims, 1);
    assert.deepEqual(result.citationAccuracy, { numerator: 1, denominator: 2 });
    assert.ok(result.evidenceCoverage.numerator >= 1);
});

test('a non-public path alias and incomplete recorded answers are rejected or excluded', (t) => {
    const root = artifacts(t);
    fs.unlinkSync(path.join(root, 'candidate.json'));
    fs.symlinkSync(path.join(root, 'applications', 'resume.html'), path.join(root, 'candidate.json'));
    const corpus = readCorpus(root, fixture());
    assert.equal(corpus.documents.has('candidate.json'), false);
    assert.throws(() => evaluate(corpus, { specialisation: [] }), /PUBLIC_EVAL_ANSWERS_INVALID/);
});

test('exact source quotations retain valid route fragments and report external references separately', (t) => {
    const root = artifacts(t);
    fs.writeFileSync(path.join(root, 'experience/index.html'), page('<p id="jdk">Oracle investigated JDK concurrency defects.</p>'));
    const corpus = readCorpus(root, fixture());
    const answers = Object.fromEntries(PROMPTS.map(({ id }) => [id, []]));
    const quote = 'Oracle investigated JDK concurrency defects.';
    answers.jvm.push({
        id: 'oracle-jdk', value: 'Oracle JDK defect investigation', citations: [
            { source: 'experience/#jdk', quote },
            { source: 'experience/#absent', quote },
            { source: 'https://example.invalid/other/', quote },
        ],
    });
    answers.kafka.push({ id: 'kafka-employment', value: 'Professional Kafka experience', citations: [] });
    const result = evaluate(corpus, answers);
    assert.deepEqual(result.citationAccuracy, { numerator: 1, denominator: 3 });
    assert.equal(result.externalCitations, 1);
    assert.equal(result.unsupportedClaims, 1);
    assert.equal(result.hallucinatedClaims, 0);
});

test('independent Kafka evidence requires a relation within the same statement', (t) => {
    const baseline = artifacts(t);
    const improved = artifacts(t);
    fs.writeFileSync(path.join(baseline, 'experience/index.html'), page('<p>Independent projects use Kotlin.</p><p>Professional Java services use Kafka.</p>'));
    fs.writeFileSync(path.join(improved, 'experience/index.html'), page('<p>Educational Kafka consumer example.</p><p>Professional Java services use Kafka.</p>'));
    const result = compare(readCorpus(baseline, fixture()), readCorpus(improved, fixture()));
    assert.equal(result.measures.baseline.prompts.kafka.factualExtraction.numerator, 1);
    assert.equal(result.measures.improved.prompts.kafka.factualExtraction.numerator, 2);
});
