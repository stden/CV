const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { facts, PROMPTS } = require('./public-cv-evaluation-rubric');

const formats = { '.html': 'html', '.pdf': 'pdf', '.json': 'json', '.md': 'markdown', '.txt': 'text' };
const DOCUMENT_LIMIT = 10 * 1024 * 1024;
const CONTROL_DIMENSIONS = ['java-backend', 'distributed-systems', 'jvm-concurrency', 'oracle-jdk', 'kafka-employment'];
const ENTITY_NAMES = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', ndash: '–', mdash: '—', middot: '·', hellip: '…' };

function normalize(text) {
    return text.normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
        if (code[0] !== '#') return Object.hasOwn(ENTITY_NAMES, code) ? ENTITY_NAMES[code] : entity;
        const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
        return number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    });
}

function htmlDocument(source) {
    const visible = source.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const main = visible.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? visible;
    const text = decodeEntities(main.replace(/<\/?(?:article|section|p|h[1-6]|li|dl|dt|dd|figure|figcaption|tr|br)\b[^>]*>/gi, '\n')
        .replace(/<[^>]*>/g, ' '));
    const language = visible.match(/<html\b[^>]*\blang\s*=\s*["']([a-z]+)(?:-[a-zA-Z]+)?["']/i)?.[1]?.toLowerCase();
    const anchors = new Set([...visible.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(([, id]) => decodeEntities(id)));
    const links = [...main.matchAll(/\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(([, url]) => decodeEntities(url));
    const blocks = text.split('\n').map((block) => block.trim()).filter(Boolean);
    const passages = blocks.flatMap((block, index) => {
        const next = blocks[index + 1];
        return next ? [block, `${block} ${next}`] : [block];
    });
    return { text, language, passages, anchors, links };
}

function jsonPassages(document) {
    if (typeof document === 'string') return [document];
    if (!document || typeof document !== 'object') return [];
    if (Array.isArray(document)) return document.flatMap(jsonPassages);
    const entries = Object.values(document);
    const scalarText = entries.flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value) => typeof value === 'string').join(' ');
    return [scalarText, ...entries.filter((value) => typeof value === 'object').flatMap(jsonPassages)];
}

function readDocument(file, format) {
    if (format === 'pdf') {
        let text;
        try {
            text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], {
                encoding: 'utf8', timeout: 10000, maxBuffer: DOCUMENT_LIMIT, stdio: ['ignore', 'pipe', 'ignore'],
            });
        } catch (error) {
            if (error.code === 'ENOENT') throw new Error('PUBLIC_EVAL_PDFTOTEXT_UNAVAILABLE');
            throw error;
        }
        const language = fs.readFileSync(file).toString('latin1').match(/\/Lang\s*\(\s*([a-z]+)(?:-[a-zA-Z]+)?\s*\)/i)?.[1]?.toLowerCase();
        const lines = text.split('\n');
        const passages = lines.flatMap((line, index) => {
            const next = lines[index + 1];
            return next?.trim() && !next.includes('\f') ? [line, `${line} ${next}`] : [line];
        });
        return { text, language, passages };
    }
    const source = fs.readFileSync(file, 'utf8');
    if (format === 'html') return htmlDocument(source);
    if (format === 'json') {
        const document = JSON.parse(source);
        const passages = jsonPassages(document);
        return { text: passages.join('\n'), language: 'en', passages };
    }
    return { text: source, language: 'en', passages: source.split(/\n\s*\n/) };
}

function readCorpus(root, { baseUrl, allowed, localeProbes = {}, excluded = [] }) {
    const documents = new Map();
    const excludedFiles = new Set(excluded);
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    try {
        const rootPath = fs.realpathSync(root);
        for (const relative of allowed) {
            const format = formats[path.extname(relative)];
            if (!format || excludedFiles.has(relative) || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(relative)) continue;
            if (relative.split('/').some((part) => part === '.' || part === '..')) continue;
            const file = path.join(rootPath, relative);
            const stat = fs.lstatSync(file, { throwIfNoEntry: false });
            if (!stat?.isFile() || stat.size > DOCUMENT_LIMIT || fs.realpathSync(file) !== file) continue;
            const document = readDocument(file, format);
            documents.set(relative, {
                ...document, format, text: normalize(document.text),
                passages: [...new Set(document.passages.map(normalize).filter(Boolean))],
            });
        }
    } catch (error) {
        if (error.message === 'PUBLIC_EVAL_PDFTOTEXT_UNAVAILABLE') throw error;
        throw new Error('PUBLIC_EVAL_CORPUS_UNREADABLE');
    }
    if (!documents.get('index.html')?.text) throw new Error('PUBLIC_EVAL_CORPUS_UNREADABLE');
    return { documents, base, localeProbes };
}

function matches(rules, text) {
    return rules.every((rule) => rule.test(text));
}

function contradicted(fact, text) {
    return fact.contradicts?.some((rule) => rule.test(text));
}

function supports(fact, text, document) {
    if (contradicted(fact, text) || !matches(fact.match, text)) return false;
    if (!fact.sourceMatch) return true;
    return (document.links ?? []).some((link) => matches(fact.sourceMatch, link))
        || matches(fact.sourceMatch, document.text);
}

function sourcePath(corpus, source) {
    try {
        const target = new URL(source, corpus.base);
        if (target.origin !== corpus.base.origin || !target.pathname.startsWith(corpus.base.pathname)) return { external: true };
        const relative = decodeURIComponent(target.pathname.slice(corpus.base.pathname.length));
        const file = corpus.documents.has(relative) ? relative : `${relative.replace(/\/?$/, '/')}index.html`;
        const document = corpus.documents.get(relative ? file : 'index.html');
        if (target.hash && document?.anchors && !document.anchors.has(decodeURIComponent(target.hash.slice(1)))) return {};
        return { document };
    } catch {
        return {};
    }
}

function checkCitation(document, citation, fact) {
    const quote = normalize(citation.quote);
    return document.text.toLowerCase().includes(quote.toLowerCase()) && supports(fact, quote, document);
}

function discover(corpus, id, format) {
    for (const [source, document] of corpus.documents) {
        if (document.language !== 'en' || (format && document.format !== format)) continue;
        const quote = document.passages.find((passage) => passage.length <= 1200 && supports(facts[id], passage, document));
        if (quote) return { id, value: quote, citations: [{ source, quote }] };
    }
    return null;
}

function dimension(numerator, denominator) {
    return { numerator, denominator };
}

function containsPair(text, [label, value]) {
    if (!label || !value) return false;
    for (let index = text.indexOf(label); index !== -1; index = text.indexOf(label, index + label.length)) {
        if (text.slice(index + label.length, index + label.length + 50).includes(value)) return true;
    }
    return false;
}

function consistency(corpus) {
    const englishFormats = new Set([...corpus.documents.values()].filter((doc) => doc.language === 'en').map((doc) => doc.format));
    const observableFormats = Object.fromEntries(Object.values(formats).map((format) => [format, {
        available: englishFormats.has(format),
        facts: dimension(CONTROL_DIMENSIONS.filter((id) => discover(corpus, id, format)).length, CONTROL_DIMENSIONS.length),
    }]));
    const languages = Object.fromEntries(Object.entries(corpus.localeProbes).map(([code, probe]) => {
        const localized = (files) => {
            const docs = files.map((file) => corpus.documents.get(file)).filter(Boolean);
            const texts = docs.map(({ text }) => text.toLowerCase());
            const markers = probe.markers.map((marker) => normalize(marker).toLowerCase());
            const pair = probe.languageLevel.map((marker) => normalize(marker).toLowerCase());
            const found = markers.filter((marker) => texts.some((text) => text.includes(marker))).length;
            return {
                available: docs.length === files.length,
                languageTag: docs.length === files.length && docs.every((doc) => doc.language === code),
                anchors: dimension(found + Number(texts.some((text) => containsPair(text, pair))), markers.length + 1),
            };
        };
        return [code, { html: localized(probe.html), pdf: localized([probe.pdf]) }];
    }));
    return { formats: observableFormats, languages };
}

function validateAnswers(answers) {
    const validText = (value, limit) => typeof value === 'string' && value.length <= limit && Boolean(normalize(value));
    if (!answers || typeof answers !== 'object' || Object.keys(answers).length !== PROMPTS.length) throw new Error('PUBLIC_EVAL_ANSWERS_INVALID');
    for (const { id } of PROMPTS) {
        if (!Object.hasOwn(answers, id) || !Array.isArray(answers[id]) || answers[id].length > 50) throw new Error('PUBLIC_EVAL_ANSWERS_INVALID');
        for (const claim of answers[id]) {
            if (!claim || !validText(claim.value, 1200) || (claim.id !== undefined && !validText(claim.id, 64))
                || !Array.isArray(claim.citations) || claim.citations.length > 10
                || !claim.citations.every((cite) => cite && validText(cite.source, 1024) && validText(cite.quote, 1200))) {
                throw new Error('PUBLIC_EVAL_ANSWERS_INVALID');
            }
        }
    }
}

function identify(claim) {
    if (claim.id !== undefined) return Object.hasOwn(facts, claim.id) ? claim.id : null;
    const classified = Object.keys(facts).filter((id) => contradicted(facts[id], claim.value) || matches(facts[id].match, claim.value));
    return classified.length === 1 ? classified[0] : null;
}

function evaluate(corpus, answers) {
    validateAnswers(answers);
    const total = { expected: 0, fact: 0, skills: 0, skillsExpected: 0, cited: 0, supportedCites: 0, citations: 0 };
    const statuses = { supported: 0, unsupported: 0, contradicted: 0, uncategorized: 0, externalCitations: 0 };
    const prompts = {};
    for (const prompt of PROMPTS) {
        const extracted = new Set();
        const backed = new Set();
        const expected = new Set(prompt.facts);
        for (const claim of answers[prompt.id]) {
            const id = identify(claim);
            const definition = facts[id];
            const value = normalize(claim.value);
            const observed = definition && discover(corpus, id);
            const contradiction = definition && contradicted(definition, value);
            const supported = !contradiction && observed && matches(definition.match, value);
            const status = !definition ? 'uncategorized' : contradiction ? 'contradicted' : supported ? 'supported' : 'unsupported';
            statuses[status]++;
            if (supported && expected.has(id)) extracted.add(id);
            total.citations += claim.citations.length;
            for (const citation of claim.citations) {
                const { document, external } = sourcePath(corpus, citation.source);
                if (external) statuses.externalCitations++;
                if (!supported || !document || !checkCitation(document, citation, definition)) continue;
                total.supportedCites++;
                if (expected.has(id)) backed.add(id);
            }
        }
        total.expected += expected.size;
        total.fact += extracted.size;
        total.skillsExpected += [...expected].filter((id) => facts[id].skill).length;
        total.skills += [...extracted].filter((id) => facts[id].skill).length;
        total.cited += backed.size;
        prompts[prompt.id] = { factualExtraction: dimension(extracted.size, expected.size), evidenceCoverage: dimension(backed.size, expected.size) };
    }
    return {
        factualExtraction: dimension(total.fact, total.expected),
        citationAccuracy: dimension(total.supportedCites, total.citations),
        skillCompleteness: dimension(total.skills, total.skillsExpected),
        evidenceCoverage: dimension(total.cited, total.expected),
        hallucinatedClaims: statuses.contradicted,
        unsupportedClaims: statuses.unsupported,
        uncategorizedClaims: statuses.uncategorized,
        externalCitations: statuses.externalCitations,
        formatConsistency: consistency(corpus),
        prompts,
    };
}

function offlineControl(corpus) {
    const answers = Object.fromEntries(PROMPTS.map(({ id, facts: expected }) => [id, expected.map((fact) => discover(corpus, fact)).filter(Boolean)]));
    return { ...evaluate(corpus, answers), hallucinatedClaims: null, unsupportedClaims: null, uncategorizedClaims: null };
}

function compare(baseline, improved, answers) {
    if (answers !== undefined && (!answers || typeof answers !== 'object' || Object.keys(answers).length !== 2
        || !Object.hasOwn(answers, 'baseline') || !Object.hasOwn(answers, 'improved'))) {
        throw new Error('PUBLIC_EVAL_ANSWERS_INVALID');
    }
    return {
        mode: answers === undefined ? 'offline-control' : 'recorded-responses',
        rubricVersion: 1,
        measures: {
            baseline: answers === undefined ? offlineControl(baseline) : evaluate(baseline, answers.baseline),
            improved: answers === undefined ? offlineControl(improved) : evaluate(improved, answers.improved),
        },
    };
}

module.exports = { PROMPTS, readCorpus, evaluate, compare };
