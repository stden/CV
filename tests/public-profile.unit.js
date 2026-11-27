const assert = require('node:assert/strict');
const { test } = require('node:test');
const data = require('../data/cv.json');
const { PROFILE_FORMATS, createPublicProfile } = require('../scripts/lib/public-profile');
const { publicFiles, availableLanguages } = require('../scripts/lib/public-artifact');
const { renderResume, renderLlms } = require('../scripts/build-profile');

test('profile exports project a fixed set of public facts from the canonical CV', () => {
    const cv = structuredClone(data);
    const ignored = 'Fictional private field';
    cv.profile.contact.phone = ignored;
    cv.profile.availability.privateNote = ignored;
    cv.experience[0].privateProject = ignored;
    cv.privateApplications = [ignored];
    const bundle = createPublicProfile(cv);
    assert.ok(!JSON.stringify(bundle).includes(ignored));
    assert.equal(bundle.candidate.professionalTitle, cv.profile.title);
    assert.equal(bundle.candidate.contentRevisionDate, cv.publicProfile.contentRevisionDate);
    assert.deepEqual(bundle.candidate.employment.map(({ id, employer, title, period }) => [id, employer, title, period]),
        cv.experience.map(({ id, company, role, period }) => [id, company, role, period]));
    assert.equal(bundle.candidate.employment[0].startDate, '2018-05');
    assert.equal(bundle.candidate.employment[0].endDate, null);
    assert.equal(bundle.candidate.employment[1].endDate, '2018-05');
    for (const markdown of [true, false]) {
        const text = renderResume(bundle, markdown);
        assert.ok(text.includes(cv.profile.name));
        assert.ok(text.includes(cv.experience[0].period));
        assert.ok(text.includes(bundle.candidate.cv.pdf));
        assert.ok(text.includes(cv.publicProfile.contentRevisionDate));
    }
    for (const file of ['resume.md', 'resume.txt', 'candidate.json', 'skills-evidence.json', 'role-alignment.json']) {
        assert.ok(renderLlms(bundle.candidate).includes(bundle.candidate.canonicalProfileUrl + file));
    }
});

test('source and role evidence preserve the difference between employer claims and public references', () => {
    const generated = createPublicProfile(data);
    const skills = generated.skillsEvidence.skills;
    const kafka = skills.find(({ id }) => id === 'apache-kafka');
    assert.equal(kafka.category, 'primary-professional');
    assert.ok(kafka.evidence.every(({ type, verificationStatus, lastVerifiedDate }) =>
        type === 'employment' && verificationStatus === 'candidate-reported' && lastVerifiedDate === null));
    assert.ok(generated.candidate.projects.every(({ sources, lastVerifiedDate, ci }) =>
        sources.length === 1 && lastVerifiedDate === null && ci.status === 'Not verified'));
    const evidence = skills.flatMap((skill) => skill.evidence.map(({ id }) => id));
    assert.equal(evidence.length, new Set(evidence).size);
    assert.equal(generated.roleAlignment.roles.length, 6);
    for (const role of generated.roleAlignment.roles) {
        assert.ok(role.evidenceIds.every((id) => evidence.includes(id)));
        assert.ok(role.limitations.length);
        assert.ok(role.requiresConfirmation.length);
    }
});

test('each output is explicitly staged and equivalent-language metadata avoids unbuilt article routes', () => {
    const files = publicFiles(data);
    assert.ok(Object.keys(PROFILE_FORMATS).every((name) => files.includes(name)));
    assert.ok(files.includes('role-alignment/index.html'));
    assert.ok(files.includes('articles/index.html'));
    assert.ok(!files.includes('data/cv.json'));
    assert.ok(!files.includes('ru/articles/index.html'));
    assert.deepEqual(availableLanguages('role-alignment/'), ['en']);
    assert.deepEqual(availableLanguages('articles/'), ['en']);
});
