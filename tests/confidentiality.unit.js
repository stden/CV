const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    checkFilename,
    checkProvenance,
    checkSiteBundle,
    scanText,
} = require('../scripts/check-confidentiality');

test('scanText detects synthetic secrets, internal hosts, and denylist terms without echoing them', () => {
    const secretToken = 'ghp_SyntheticTestTokenValue1234567890';
    const privateHost = 'https://synthetic-internal-portal.example.invalid/api';
    const internalDomain = 'db-shard-01.corp';
    const privateIp = '10.42.8.15';
    const ticketId = 'PROJ-4821';
    const denyTerm = 'SyntheticProjectCodename';

    const failures = [];
    const payload = [secretToken, privateHost, internalDomain, privateIp, ticketId, denyTerm].join(' | ');
    scanText('synthetic-fixture.html', payload, [denyTerm], failures);

    assert.ok(failures.length >= 5);
    const joined = failures.join('\n');
    for (const sensitive of [secretToken, 'synthetic-internal-portal.example.invalid', internalDomain, privateIp, ticketId, denyTerm]) {
        assert.ok(!joined.includes(sensitive), `Error output leaked sensitive token: ${sensitive}`);
    }
    assert.match(joined, /\[redacted\]/);
});

test('checkFilename rejects forbidden non-public deployment paths and sensitive filenames', () => {
    const failures = [];
    checkFilename('applications/acme-java/resume.pdf', [], failures, { strictDeployment: true });
    checkFilename('assets/internal-secret-notes.txt', [], failures, { strictDeployment: true });
    assert.equal(failures.length, 2);
    assert.ok(!failures.join('\n').includes('acme-java'));
});

test('checkSiteBundle catches private artifacts and unapproved SVG metadata in staged directories', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-site-bundle-'));
    try {
        fs.mkdirSync(path.join(tmp, 'applications'), { recursive: true });
        fs.copyFileSync(
            path.join(__dirname, '..', 'assets', 'pdf', 'Denis-Stepulenok-Senior-Software-Engineer.pdf'),
            path.join(tmp, 'applications', 'resume.pdf')
        );
        fs.writeFileSync(path.join(tmp, 'diagram.svg'), '<svg><metadata>secret</metadata></svg>');
        const failures = [];
        checkSiteBundle(tmp, [], failures);
        assert.ok(failures.some((f) => f.includes('forbidden non-public path')));
        assert.ok(failures.some((f) => f.includes('SVG must not contain <metadata>')));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('checkProvenance rejects employer-origin case studies or educational diagrams missing disclaimer', () => {
    const failures = [];
    checkProvenance(
        {
            profile: { availability: { showOpenToWork: true } },
            caseStudies: [{ id: 'x', origin: 'employer', scopeType: 'employer' }],
            architectureDiagrams: [{ slug: 'y', origin: 'educational-example', originLabel: 'Diagram' }],
        },
        failures
    );
    assert.equal(failures.length, 3);
});
