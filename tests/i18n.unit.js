const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const { ROOT_DIR, loadCvData } = require('../scripts/lib/utils');
const { LOCALES, validateLocales, localizeData, setLocale, ui, switchTarget } = require('../scripts/lib/i18n');
const { INTER_SUBSETS } = require('../scripts/lib/fonts');

// These tests read the generated site and the data. Run `npm run build` first.
const data = loadCvData();
const read = (file) => fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT_DIR, file));
const TRANSLATED = ['index.html', 'experience/index.html', 'projects/index.html', 'skills/index.html', 'cv/index.html'];
const localeFile = (code) => JSON.parse(read(`data/locales/${code}.json`));
const pageOf = (code, file) => (code === 'en' ? file : `${code}/${file}`);
const CODES = LOCALES.map((locale) => locale.code);

describe('translation resources', () => {
    test('every locale provides every key the site and the resumes use', () => {
        assert.deepEqual(validateLocales(data), []);
    });

    test('no locale has an empty UI string', () => {
        for (const code of CODES) {
            for (const [key, value] of Object.entries(localeFile(code).ui)) {
                assert.ok(String(value).trim(), `${code}.${key} is empty`);
            }
        }
    });

    test('UI placeholders are the same in every locale', () => {
        const english = localeFile('en').ui;
        for (const code of CODES) {
            for (const [key, template] of Object.entries(localeFile(code).ui)) {
                const expected = (english[key].match(/\{\w+\}/g) || []).sort().join(',');
                const actual = (template.match(/\{\w+\}/g) || []).sort().join(',');
                assert.equal(actual, expected, `${code}.${key} has different placeholders`);
            }
        }
    });

    test('a missing translation is reported, so the build fails', () => {
        const broken = structuredClone(data);
        broken.experience.push({ ...broken.experience[0], id: 'not-translated' });
        const problems = validateLocales(broken);
        assert.ok(problems.some((problem) => problem.includes('not-translated')), problems.join('\n'));
    });

    test('a changed number of responsibilities is reported', () => {
        const broken = structuredClone(data);
        broken.experience[0].responsibilities.push('An extra responsibility with no translation.');
        assert.ok(validateLocales(broken).some((problem) => problem.includes('responsibilities of kuehne-nagel')));
    });
});

describe('the translation keeps the verified facts', () => {
    test('dates, employers, contact details and technology names are not translated', () => {
        for (const code of ['et', 'de', 'ru']) {
            const copy = localizeData(data, code);
            copy.experience.forEach((role, index) => {
                const canonical = data.experience[index];
                assert.equal(role.period, canonical.period, `${code}: period of ${canonical.id}`);
                assert.equal(role.company, canonical.company, `${code}: employer of ${canonical.id}`);
                assert.deepEqual(role.projectTechnologies, canonical.projectTechnologies, `${code}: technologies of ${canonical.id}`);
            });
            assert.deepEqual(copy.profile.contact, data.profile.contact, `${code}: contact details`);
            assert.equal(copy.variants.length, data.variants.length, `${code}: variants`);
        }
    });

    test('language proficiency is the one in the source CV, in every locale', () => {
        assert.deepEqual(data.languages.map((item) => item.level), ['Native', 'Intermediate']);
        for (const code of ['et', 'de', 'ru']) {
            const copy = localizeData(data, code);
            assert.equal(copy.languages.length, data.languages.length, `${code}: language count`);
            assert.equal(copy.languages.map((item) => item.name).length, 2);
        }
    });

    test('translations add no skills, employers or projects', () => {
        for (const code of ['et', 'de', 'ru']) {
            const copy = localizeData(data, code);
            assert.equal(copy.skills.reduce((n, group) => n + group.items.length, 0), data.skills.reduce((n, group) => n + group.items.length, 0));
            assert.equal(copy.caseStudies.length, data.caseStudies.length);
            assert.equal(copy.githubProjects.length, data.githubProjects.length);
        }
    });
});

describe('static language pages', () => {
    test('every locale has its homepage, experience, projects, skills and CV index', () => {
        for (const code of CODES) {
            for (const file of TRANSLATED) assert.ok(exists(pageOf(code, file)), `${pageOf(code, file)} is missing`);
        }
    });

    test('the html lang attribute matches the locale', () => {
        for (const code of CODES) {
            const htmlLang = LOCALES.find((locale) => locale.code === code).htmlLang;
            for (const file of TRANSLATED) {
                assert.match(read(pageOf(code, file)), new RegExp(`<html lang="${htmlLang}">`), `${pageOf(code, file)}`);
            }
        }
    });

    test('each translated page links to every language, and x-default points to English', () => {
        for (const file of TRANSLATED) {
            const home = read(pageOf('en', file));
            for (const code of CODES) {
                const htmlLang = LOCALES.find((locale) => locale.code === code).htmlLang;
                assert.match(home, new RegExp(`<link rel="alternate" hreflang="${htmlLang}" href="[^"]*${pageOf(code, file).replace(/index\.html$/, '')}`));
            }
            const xDefault = home.match(/hreflang="x-default" href="([^"]+)"/);
            assert.ok(xDefault, `${file} has no x-default`);
            assert.ok(xDefault[1].endsWith('/CV/') || xDefault[1].endsWith('/CV/' + file.replace(/index\.html$/, '')), xDefault[1]);
        }
    });

    test('canonical URLs carry the locale folder and the GitHub Pages base path', () => {
        assert.match(read('et/index.html'), /<link rel="canonical" href="https:\/\/stden\.github\.io\/CV\/et\/">/);
        assert.match(read('de/cv/index.html'), /<link rel="canonical" href="https:\/\/stden\.github\.io\/CV\/de\/cv\/">/);
    });

    test('every translated page has the language switcher with the current language marked', () => {
        for (const code of CODES) {
            for (const file of TRANSLATED) {
                const html = read(pageOf(code, file));
                assert.match(html, /<nav class="lang-switcher"/, pageOf(code, file));
                const current = html.match(/<a [^>]*class="lang-link is-current"[^>]*>/g) || [];
                assert.ok(current.length >= 1, `${pageOf(code, file)} marks no current language`);
                assert.match(current[0], /aria-current="true"/);
            }
        }
    });

    test('the language switch leads to the equivalent translated page', () => {
        assert.equal(switchTarget('et', 'experience'), 'et/experience/index.html');
        assert.equal(switchTarget('ru', 'skills'), 'ru/skills/index.html');
        assert.equal(switchTarget('de', 'architecture'), 'de/index.html', 'an untranslated page falls back to the locale homepage');
        assert.equal(switchTarget('en', 'architecture'), 'architecture/index.html');
    });

    test('translated pages contain no leftover English interface text', () => {
        const english = ['Professional Experience', 'Core Skills', 'Selected Projects', 'Full employment history', 'Download CV (PDF)', 'Skip to main content'];
        for (const code of ['et', 'de', 'ru']) {
            for (const file of TRANSLATED) {
                const text = read(pageOf(code, file)).replace(/<[^>]+>/g, ' ');
                for (const phrase of english) {
                    assert.ok(!text.includes(phrase), `${pageOf(code, file)} still says "${phrase}"`);
                }
            }
        }
    });

    test('internal links on translated pages resolve to files', () => {
        for (const code of CODES) {
            for (const file of TRANSLATED) {
                const page = pageOf(code, file);
                const html = read(page);
                for (const [, value] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
                    if (/^(https?:|mailto:|#|tel:)/.test(value)) continue;
                    const [target] = value.split('#');
                    if (!target) continue;
                    const resolved = path.normalize(path.join(path.dirname(page), decodeURIComponent(target)));
                    const found = exists(resolved) || exists(path.join(resolved, 'index.html'));
                    assert.ok(found, `${page} links to missing ${value}`);
                }
            }
        }
    });

    test('the translated sitemap lists every language with alternates', () => {
        const sitemap = read('sitemap.xml');
        assert.ok(sitemap.includes('xmlns:xhtml='));
        for (const code of CODES) assert.ok(sitemap.includes(`https://stden.github.io/CV/${code === 'en' ? '' : code + '/'}`));
        assert.ok(sitemap.includes('hreflang="x-default"'));
    });
});

describe('resume PDFs in each language', () => {
    test('one resume per language exists and is a PDF', () => {
        for (const code of CODES) {
            const file = `assets/pdf/Denis-Stepulenok-CV-${code.toUpperCase()}.pdf`;
            assert.ok(exists(file), `${file} is missing`);
            assert.equal(read(file).slice(0, 5), '%PDF-');
        }
    });

    test('the Download CV buttons point to the resume of their language', () => {
        assert.match(read('index.html'), /href="assets\/pdf\/Denis-Stepulenok-CV-EN\.pdf"/);
        assert.match(read('et/index.html'), /href="\.\.\/assets\/pdf\/Denis-Stepulenok-CV-ET\.pdf"/);
        assert.match(read('de/index.html'), /href="\.\.\/assets\/pdf\/Denis-Stepulenok-CV-DE\.pdf"/);
        assert.match(read('ru/index.html'), /href="\.\.\/assets\/pdf\/Denis-Stepulenok-CV-RU\.pdf"/);
    });

    test('the font subsets needed for Cyrillic and Estonian letters are embedded and declared', () => {
        for (const { subset, range } of INTER_SUBSETS) {
            assert.ok(exists(`assets/fonts/inter-${subset}-wght-normal.woff2`), `${subset} font file is missing`);
            assert.ok(read('assets/css/style.css').includes(range), `${subset} unicode-range is not declared in the stylesheet`);
        }
    });

    test('the Estonian and Russian resumes contain their own headings', () => {
        const { execFileSync } = require('node:child_process');
        const text = (file) => execFileSync('pdftotext', [path.join(ROOT_DIR, file), '-'], { encoding: 'utf8' });
        assert.match(text('assets/pdf/Denis-Stepulenok-CV-ET.pdf'), /KOKKUVÕTE/);
        assert.match(text('assets/pdf/Denis-Stepulenok-CV-RU.pdf'), /технические навыки/i);
        assert.match(text('assets/pdf/Denis-Stepulenok-CV-DE.pdf'), /PROFIL/i);
    });
});

describe('language strings are looked up per locale', () => {
    test('ui() returns the text of the locale that is set', () => {
        setLocale('et');
        assert.equal(ui('navExperience'), 'Kogemus');
        setLocale('en');
        assert.equal(ui('navExperience'), 'Experience');
    });

    test('a placeholder without a value is an error, not an empty string', () => {
        setLocale('en');
        assert.throws(() => ui('contactLead'));
    });
});
