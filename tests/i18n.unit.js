const assert = require('node:assert/strict');
const { test } = require('node:test');
const data = require('../data/cv.json');
const { loadLocales, localeCodes, localize, validateLocales } = require('../scripts/lib/i18n');
const { publicFiles } = require('../scripts/lib/public-artifact');

test('every language has the same mandatory keys and compatible placeholders', () => {
    const locales = loadLocales(data);
    const missing = structuredClone(locales);
    delete missing.et['profile.summary'];
    assert.throws(() => validateLocales(data, missing), /LOCALE_MISSING et profile.summary/);

    const misplaced = structuredClone(locales);
    misplaced.de['ui.action.copySuccess'] = 'Ausgedachter Wert';
    assert.throws(() => validateLocales(data, misplaced), /LOCALE_PLACEHOLDERS de ui.action.copySuccess/);

    const stale = structuredClone(locales);
    stale.en['profile.summary'] = 'Fictional replacement';
    assert.throws(() => validateLocales(data, stale), /LOCALE_SOURCE_MISMATCH en profile.summary/);
});

test('locale views preserve shared facts and retain only the recorded languages', () => {
    const locales = loadLocales(data);
    for (const code of localeCodes) {
        const cv = localize(data, code, locales[code]);
        assert.deepEqual(cv.profile.contact, data.profile.contact);
        assert.deepEqual(cv.experience.map(({ id, company, period, projectTechnologies }) =>
            [id, company, period.match(/\d+/g), projectTechnologies]),
        data.experience.map(({ id, company, period, projectTechnologies }) =>
            [id, company, period.match(/\d+/g), projectTechnologies]));
        assert.deepEqual(cv.githubProjects.map(({ name, url }) => [name, url]), data.githubProjects.map(({ name, url }) => [name, url]));
        assert.equal(cv.languages.length, 2);
        assert.equal(cv.languages[1].level, locales[code]['language.english.level']);
    }
});

test('publication includes translated pages and PDFs while locale resources remain private to the build', () => {
    const files = publicFiles(data);
    for (const code of localeCodes) {
        const prefix = code === 'en' ? '' : `${code}/`;
        assert.ok(files.includes(`${prefix}contact/index.html`));
        assert.ok(files.includes(`${prefix}cv/general.html`));
        assert.ok(files.includes(`assets/pdf/Denis-Stepulenok-CV-${code.toUpperCase()}.pdf`));
    }
    assert.ok(files.includes('cv/wise.html'));
    assert.ok(!files.some((file) => /^(data\/|applications\/)/.test(file)));
});
