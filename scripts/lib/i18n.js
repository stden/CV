const fs = require('node:fs');
const path = require('node:path');

const LOCALES = {
    en: { nativeName: 'English', label: 'EN', og: 'en_GB' },
    et: { nativeName: 'Eesti', label: 'ET', og: 'et_EE' },
    de: { nativeName: 'Deutsch', label: 'DE', og: 'de_DE' },
    ru: { nativeName: 'Русский', label: 'RU', og: 'ru_RU' },
};
const localeDirectory = path.resolve(__dirname, '../../data/locales');
const localeCodes = Object.keys(LOCALES);
const skillLabels = new Map([
    ['jvm & concurrency', 'jvm'],
    ['distributed systems', 'distributed'],
    ['enterprise integration', 'integration'],
    ['microservices', 'microservices'],
    ['software design & algorithms', 'design'],
    ['vector databases', 'vector'],
    ['rag / embeddings / semantic search', 'retrieval'],
    ['local llms / ollama', 'localModels'],
    ['large language models (claude, gpt, gemini)', 'largeModels'],
    ['ai-assisted development (claude code, codex, copilot, gemini)', 'assisted'],
    ['test-driven development (tdd)', 'tdd'],
    ['integration & e2e testing', 'integrationTesting'],
    ['continuous integration', 'ci'],
]);

function localizedSkillName(data, name) {
    const key = skillLabels.get(name.toLowerCase());
    return key && data.locale !== 'en' && data.t ? data.t(`ui.skills.${key}`) : name;
}

function walkContent(data, visit) {
    const fields = (prefix, object, names) => {
        for (const name of names) {
            const value = object[name];
            const key = `${prefix}.${name}`;
            if (Array.isArray(value)) {
                value.forEach((text, index) => visit(`${key}.${index + 1}`, value, index, text));
            } else if (typeof value === 'string' && value) {
                visit(key, object, name, value);
            }
        }
    };
    fields('site', data.site, ['title', 'description']);
    fields('profile', data.profile, ['title', 'summary', 'photoAlt', 'location']);
    data.expertise.forEach((item) => fields(`expertise.${item.id}`, item, ['title', 'description']));
    data.experience.forEach((item) => fields(`experience.${item.id}`, item,
        ['role', 'companyNote', 'location', 'summary', 'responsibilities']));
    data.caseStudies.forEach((item) => {
        const key = `case.${item.id}`;
        fields(key, item, ['title', 'scope', 'problem', 'context', 'architecture', 'challenges', 'decisions', 'reliability', 'results']);
        fields(`${key}.provenance`, item.provenance, ['summary']);
    });
    data.githubProjects.forEach((item) => fields(`repo.${item.name}`, item,
        ['description', 'previewAlt', 'previewCaption', 'topics']));
    data.architectureDiagrams.forEach((item) => {
        const key = `diagram.${item.slug}`;
        fields(key, item, ['label', 'title', 'tabTitle', 'originLabel', 'summary']);
        fields(`${key}.provenance`, item.provenance, ['summary']);
        item.nodes.forEach((node) => fields(`${key}.node.${node.id}`, node,
            ['title', 'detail', 'responsibility', 'concepts', 'tradeoffs']));
    });
    data.engineeringConcepts.forEach((item, index) => fields(`concept.${index + 1}`, item, ['name', 'description']));
    data.skills.forEach((item) => fields(`skillGroup.${item.id}`, item, ['title', 'description']));
    data.education.forEach((item, index) => fields(`education.${index + 1}`, item, ['degree', 'institution']));
    data.languages.forEach((item) => fields(`language.${item.name.toLowerCase()}`, item, ['name', 'level']));
    fields('profile', data, ['interests']);
    data.technologies.forEach((item) => fields(`technology.${item.slug}`, item, ['summary', 'flow', 'capabilities', 'usedIn']));
    const general = data.variants.find(({ slug }) => slug === 'general');
    fields('cv.general', general, ['roleTitle', 'shortLabel', 'summary', 'focusHighlights']);
}

function canonicalMessages(data) {
    const messages = {};
    walkContent(data, (key, _, __, text) => { messages[key] = text; });
    return messages;
}

function readLocale(code) {
    return JSON.parse(fs.readFileSync(path.join(localeDirectory, `${code}.json`), 'utf8'));
}

function placeholders(message) {
    return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(([, name]) => name).sort().join(',');
}

function validateLocales(data, dictionaries) {
    const canonical = canonicalMessages(data);
    const english = dictionaries.en;
    const keys = new Set(Object.keys(english));
    for (const [key, value] of Object.entries(canonical)) {
        if (english[key] !== value) throw new Error(`LOCALE_SOURCE_MISMATCH en ${key}`);
    }
    for (const code of localeCodes) {
        const dictionary = dictionaries[code];
        for (const key of keys) {
            if (typeof dictionary?.[key] !== 'string' || !dictionary[key].trim()) throw new Error(`LOCALE_MISSING ${code} ${key}`);
            if (placeholders(dictionary[key]) !== placeholders(english[key])) {
                throw new Error(`LOCALE_PLACEHOLDERS ${code} ${key}`);
            }
        }
        for (const key of Object.keys(dictionary)) {
            if (!keys.has(key) || (!key.startsWith('ui.') && !Object.hasOwn(canonical, key))) {
                throw new Error(`LOCALE_UNKNOWN ${code}`);
            }
        }
    }
}

function loadLocales(data) {
    const dictionaries = Object.fromEntries(localeCodes.map((code) => [code, readLocale(code)]));
    validateLocales(data, dictionaries);
    return dictionaries;
}

function localize(data, code, dictionary) {
    const localized = structuredClone(data);
    const t = (key, vars = {}) => {
        const value = dictionary[key];
        if (typeof value !== 'string' || !value.trim()) throw new Error(`LOCALE_MISSING ${code} ${key}`);
        return value.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (literal, name) => String(vars[name] ?? literal));
    };
    walkContent(localized, (key, object, name) => { object[name] = t(key); });
    const formatPeriod = (period) => period.replace(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December|Present)\b/g,
        (month) => t(`ui.month.${month}`),
    );
    for (const entry of [...localized.experience, ...localized.education]) entry.period = formatPeriod(entry.period);
    return Object.assign(localized, { locale: code, t });
}

function localizedPath(code, contentPath = '') {
    return code === 'en' ? contentPath : `${code}/${contentPath}`;
}

function localizedPdfName(code) {
    return `Denis-Stepulenok-CV-${code.toUpperCase()}.pdf`;
}

module.exports = {
    LOCALES, localeCodes, canonicalMessages, validateLocales, loadLocales, localize, localizedPath, localizedPdfName, localizedSkillName,
};
