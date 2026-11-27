const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR } = require('./utils');

// Supported locales. English is the canonical language of data/cv.json; the other
// locales only overlay human-readable text, keyed by stable identifiers.
const LOCALES = [
    { code: 'en', htmlLang: 'en', dir: '', label: 'EN', name: 'English' },
    { code: 'et', htmlLang: 'et', dir: 'et/', label: 'ET', name: 'Eesti' },
    { code: 'de', htmlLang: 'de', dir: 'de/', label: 'DE', name: 'Deutsch' },
    { code: 'ru', htmlLang: 'ru', dir: 'ru/', label: 'RU', name: 'Русский' },
];

const LOCALE_DIR = path.join(ROOT_DIR, 'data', 'locales');
const EN_UI_KEYS_FILE = path.join(LOCALE_DIR, 'en.json');

let current = null;

function readLocaleFile(code) {
    return JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, `${code}.json`), 'utf8'));
}

function localeInfo(code) {
    const info = LOCALES.find((locale) => locale.code === code);
    if (!info) throw new Error(`Unknown locale: ${code}`);
    return info;
}

// The UI strings of the locale being built. Missing keys are a build error, never a silent English fallback.
function setLocale(code) {
    localeInfo(code);
    current = { code, ...readLocaleFile(code) };
    current.ui = current.ui || {};
    return current;
}

function ui(key, values = {}) {
    if (!current) throw new Error('ui() called before setLocale()');
    const template = current.ui[key];
    if (typeof template !== 'string') throw new Error(`Missing UI string "${key}" for locale ${current.code}`);
    return template.replace(/\{(\w+)\}/g, (match, name) => {
        if (!(name in values)) throw new Error(`UI string "${key}" needs the value "${name}"`);
        return values[name];
    });
}

function duplicates(values) {
    const seen = new Set();
    const repeated = [];
    for (const value of values) {
        if (seen.has(value)) repeated.push(value);
        seen.add(value);
    }
    return repeated;
}

// Every key a translation must provide. Returns a list of problems; an empty list means complete.
function validateLocales(data) {
    const problems = [];
    const englishUi = Object.keys(JSON.parse(fs.readFileSync(EN_UI_KEYS_FILE, 'utf8')).ui);
    const needNames = new Set([
        ...data.skills.flatMap((group) => group.items.map((item) => item.name)),
        ...data.profile.coreSkillGroups.flatMap((group) => group.items),
    ]);

    for (const locale of LOCALES.filter((item) => item.code !== 'en')) {
        const file = readLocaleFile(locale.code);
        const where = (text) => problems.push(`${locale.code}: ${text}`);
        for (const key of englishUi) {
            if (typeof file.ui?.[key] !== 'string' || !file.ui[key].trim()) where(`missing UI string "${key}"`);
        }
        if (!file.meta?.title?.trim() || !file.meta?.description?.trim()) where('missing meta.title or meta.description');
        const profile = file.profile || {};
        for (const key of ['title', 'location', 'photoAlt', 'summary', 'homeIntro']) {
            if (typeof profile[key] !== 'string' || !profile[key].trim()) where(`missing profile.${key}`);
        }
        for (const role of data.experience.concat(data.earlierExperience ?? [])) {
            const overlay = file.experience?.[role.id];
            if (!overlay) {
                where(`missing experience overlay for ${role.id}`);
                continue;
            }
            if (!overlay.role || !overlay.location || !overlay.summary) where(`incomplete experience ${role.id}`);
            if (role.companyNote && !overlay.companyNote) where(`missing companyNote for ${role.id}`);
            if (!Array.isArray(overlay.responsibilities) || overlay.responsibilities.length !== role.responsibilities.length) {
                where(`responsibilities of ${role.id} must match the canonical count (${role.responsibilities.length})`);
            }
            if (role.homeSummary && !overlay.homeSummary?.trim()) where(`missing homeSummary for ${role.id}`);
            if (role.homeBullets && (!Array.isArray(overlay.homeBullets) || overlay.homeBullets.length !== role.homeBullets.length)) {
                where(`homeBullets of ${role.id} must match the canonical count`);
            }
        }
        for (const group of data.skills) {
            const overlay = file.skillGroups?.[group.id];
            if (!overlay || !overlay.title || !overlay.description) where(`missing skill group ${group.id}`);
        }
        for (const group of data.profile.coreSkillGroups) {
            const overlay = file.coreSkillGroups?.[group.id];
            if (!overlay || !overlay.title || !overlay.description) where(`missing core skill group ${group.id}`);
        }
        for (const name of needNames) {
            if (typeof file.skillNames?.[name] !== 'string') where(`missing skill name "${name}"`);
        }
        for (const repo of data.githubProjects) {
            const overlay = file.githubProjects?.[repo.name];
            if (!overlay || !overlay.description) where(`missing description for ${repo.name}`);
            if (repo.featured && (!overlay || !overlay.homeSummary)) where(`missing homeSummary for ${repo.name}`);
        }
        for (const study of data.caseStudies) {
            const overlay = file.caseStudies?.[study.id];
            if (!overlay) {
                where(`missing case study ${study.id}`);
                continue;
            }
            for (const field of ['title', 'scope', 'problem', 'context', 'architecture']) {
                if (typeof overlay[field] !== 'string' || !overlay[field].trim()) where(`missing ${field} for ${study.id}`);
            }
            for (const field of ['challenges', 'decisions', 'reliability', 'results']) {
                if (!Array.isArray(overlay[field]) || overlay[field].length !== study[field].length) {
                    where(`${field} of ${study.id} must match the canonical count (${study[field].length})`);
                }
            }
        }
        if (!Array.isArray(file.education) || file.education.length !== data.education.length) where('education count differs');
        else file.education.forEach((item, i) => { if (!item.degree?.trim() || !item.institution?.trim()) where(`incomplete education ${i}`); });
        if (!Array.isArray(file.languages) || file.languages.length !== data.languages.length) where('languages count differs');
        else file.languages.forEach((item, i) => { if (!item.name?.trim() || !item.level?.trim()) where(`incomplete language ${i}`); });
        if (!Array.isArray(file.interests) || file.interests.length !== data.interests.length) where('interests count differs');
        else file.interests.forEach((item, i) => { if (!String(item).trim()) where(`empty interest ${i}`); });
        for (const variant of data.variants) {
            const overlay = file.variants?.[variant.slug];
            if (!overlay || !overlay.shortLabel || !overlay.targetAudience) where(`missing variant ${variant.slug}`);
            if (variant.slug === 'general' && !overlay?.roleTitle) where('missing roleTitle of general');
            if (variant.slug === 'general' && (!Array.isArray(overlay?.focusHighlights) || overlay.focusHighlights.length !== variant.focusHighlights.length)) {
                where('focusHighlights of general must match the canonical count');
            }
        }
    }
    return problems;
}

// Returns a copy of the canonical data with the locale's text in place. Structure, dates,
// employers, technology names, links and contact details are never overlaid.
function localizeData(data, code) {
    if (code === 'en') return data;
    const file = readLocaleFile(code);
    const copy = structuredClone(data);
    copy.site = { ...copy.site, title: file.meta.title, description: file.meta.description };
    Object.assign(copy.profile, {
        title: file.profile.title,
        location: file.profile.location,
        photoAlt: file.profile.photoAlt,
        summary: file.profile.summary,
        homeIntro: file.profile.homeIntro,
    });
    for (const role of copy.experience.concat(copy.earlierExperience ?? [])) {
        const overlay = file.experience[role.id];
        Object.assign(role, {
            role: overlay.role,
            location: overlay.location,
            summary: overlay.summary,
            responsibilities: overlay.responsibilities,
        });
        if (role.companyNote) role.companyNote = overlay.companyNote;
        if (role.homeBullets) role.homeBullets = overlay.homeBullets;
        if (overlay.homeSummary) role.homeSummary = overlay.homeSummary;
    }
    for (const group of copy.skills) Object.assign(group, file.skillGroups[group.id]);
    for (const group of copy.profile.coreSkillGroups) {
        Object.assign(group, file.coreSkillGroups[group.id]);
        group.items = group.items.map((name) => file.skillNames[name]);
    }
    for (const group of copy.skills) {
        for (const item of group.items) item.name = file.skillNames[item.name];
    }
    for (const repo of copy.githubProjects) {
        const overlay = file.githubProjects[repo.name];
        repo.description = overlay.description;
        if (overlay.homeSummary) repo.homeSummary = overlay.homeSummary;
    }
    for (const study of copy.caseStudies) {
        Object.assign(study, file.caseStudies[study.id]);
    }
    copy.education = copy.education.map((item, index) => ({ ...item, ...file.education[index] }));
    copy.languages = copy.languages.map((item, index) => ({ ...item, ...file.languages[index] }));
    copy.interests = file.interests;
    for (const variant of copy.variants) {
        const overlay = file.variants[variant.slug];
        variant.shortLabel = overlay.shortLabel;
        variant.targetAudience = overlay.targetAudience;
        if (overlay.summary) variant.summary = overlay.summary;
        if (overlay.focusHighlights) variant.focusHighlights = overlay.focusHighlights;
        if (overlay.roleTitle) variant.roleTitle = overlay.roleTitle;
        if (Array.isArray(variant.skillNames)) variant.skillNames = variant.skillNames.map((name) => file.skillNames[name]);
        if (variant.slug === 'general') variant.pdfFilename = cvPdfName(code);
    }
    return copy;
}

module.exports = { LOCALES, localeInfo, setLocale, ui, validateLocales, localizeData };

// Pages that exist in every locale. Everything else (architecture, variant CVs, technology
// pages) is English only; its language switch goes to the locale's homepage.
const TRANSLATED_PAGE_KEYS = ['home', 'experience', 'projects', 'skills', 'cv-index'];

const PAGE_FILES = {
    home: 'index.html',
    experience: 'experience/index.html',
    projects: 'projects/index.html',
    skills: 'skills/index.html',
    'cv-index': 'cv/index.html',
    architecture: 'architecture/index.html',
};

// Output path of a page for a locale, relative to the site root.
function pageOutputPath(code, pageKey) {
    if (PAGE_FILES[pageKey] === undefined) return pageKey;
    if (!TRANSLATED_PAGE_KEYS.includes(pageKey)) return PAGE_FILES[pageKey];
    return localeInfo(code).dir + PAGE_FILES[pageKey];
}

function isTranslatedPage(pageKey) {
    return TRANSLATED_PAGE_KEYS.includes(pageKey);
}

// Where the language switch of a page leads for a given locale.
function switchTarget(code, pageKey) {
    if (code === 'en' || isTranslatedPage(pageKey)) return pageOutputPath(code, pageKey);
    return pageOutputPath(code, 'home');
}

function currentLocaleCode() {
    if (!current) throw new Error('currentLocaleCode() called before setLocale()');
    return current.code;
}

// The PDF resume offered by the Download CV buttons on each locale.
function cvPdfName(code) {
    return `Denis-Stepulenok-CV-${code.toUpperCase()}.pdf`;
}

module.exports.TRANSLATED_PAGE_KEYS = TRANSLATED_PAGE_KEYS;
module.exports.pageOutputPath = pageOutputPath;
module.exports.isTranslatedPage = isTranslatedPage;
module.exports.switchTarget = switchTarget;
module.exports.currentLocaleCode = currentLocaleCode;
module.exports.cvPdfName = cvPdfName;
