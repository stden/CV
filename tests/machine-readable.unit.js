const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { ROOT_DIR, loadCvData } = require('../scripts/lib/utils');
const {
    buildCandidateProfile,
    buildSkillsEvidence,
    buildRoleAlignment,
    buildResumeMarkdown,
    buildResumeText,
    buildLlmsTxt,
} = require('../scripts/build-machine-readable');
const { evaluateArtifact } = require('../scripts/eval-ai-readiness');

test('machine-readable JSON profiles enforce allowlist and preserve factual identity', () => {
    const data = loadCvData();
    const candidate = buildCandidateProfile(data);
    const skills = buildSkillsEvidence(data);
    const roles = buildRoleAlignment(data);

    assert.equal(candidate.schemaVersion, '1.0.0');
    assert.equal(candidate.canonicalProfileUrl, 'https://stden.github.io/CV/');
    assert.equal(candidate.canonicalLanguage, 'en');
    assert.equal(candidate.identity.name, 'Denis Stepulenok');
    assert.equal(candidate.identity.openToWorkDisclosed, false);
    assert.equal(candidate.availabilityStatus, undefined);
    assert.equal(candidate.employmentHistory.length, data.experience.length);
    for (const emp of candidate.employmentHistory) {
        assert.equal(emp.verificationStatus, 'self-reported');
    }
    assert.equal(candidate.publicProjects.length, 6);

    assert.equal(skills.skillsCount, 51);
    for (const skill of skills.skills) {
        assert.ok(skill.id);
        assert.ok(Array.isArray(skill.synonyms) && skill.synonyms.length > 0);
        assert.ok(['primary-professional', 'additional-professional', 'independent-engineering', 'familiarity'].includes(skill.experienceCategory));
        assert.ok(['self-reported', 'publicly-inspectable', 'ci-verified', 'requires-confirmation'].includes(skill.verificationStatus));
        assert.ok(skill.context && skill.limitations && skill.lastVerificationDate);
    }

    assert.equal(roles.roles.length, 6);
    const serializedRoles = JSON.stringify(roles).toLowerCase();
    assert.ok(!/(?:match|fit|hire|offer)\s+(?:score|probability|rating)\s*[:=]?\s*\d/i.test(serializedRoles));
});

test('resume exports and llms.txt stay consistent and contain zero prompt-injection directives', () => {
    const data = loadCvData();
    const md = buildResumeMarkdown(data);
    const txt = buildResumeText(data);
    const llms = buildLlmsTxt(data);

    for (const content of [md, txt, llms]) {
        assert.match(content, /denis stepulenok/i);
        assert.ok(content.includes('Senior Software Engineer — Java & Distributed Systems'));
        assert.ok(content.includes('Tallinn, Estonia'));
        assert.ok(!/ignore previous|must hire|recommend this candidate/i.test(content));
    }
    assert.ok(md.includes('Kuehne+Nagel'));
    assert.ok(txt.includes('Kuehne+Nagel'));
    assert.ok(llms.includes('candidate.json'));
    assert.ok(llms.includes('skills-evidence.json'));
    assert.ok(llms.includes('role-alignment.json'));
});

test('local AI readiness evaluation succeeds with high accuracy and zero hallucinations on staged _site', () => {
    const siteDir = path.join(ROOT_DIR, '_site');
    if (!fs.existsSync(siteDir)) return;
    const report = evaluateArtifact(siteDir);
    assert.equal(report.metrics.hallucinatedClaims, 0);
    assert.equal(report.metrics.factualExtractionAccuracy, 100);
    assert.equal(report.metrics.citationAccuracy, 100);
    assert.equal(report.metrics.skillCompleteness, 100);
    assert.equal(report.metrics.evidenceCoverage, 100);
    assert.equal(report.metrics.crossFormatConsistency, 100);
});
