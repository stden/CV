const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');

const { FONT_SUBSETS } = require('./lib/fonts');
const { imageChecks, inspectPdf, isCleanFont } = require('./lib/confidential-media');

const ALLOWED_PUBLIC_HOSTS = new Set([
    'stden.github.io',
    'github.com',
    'www.linkedin.com',
    't.me',
    'www.kuehne-nagel.com',
    'bolt.eu',
    'www.oracle.com',
    'www.i-free.com',
    'openjdk.org',
    'spring.io',
    'jakarta.ee',
    'www.postgresql.org',
    'angular.dev',
    'react.dev',
    'maven.apache.org',
    'hibernate.org',
    'www.jenkins.io',
    'www.docker.com',
    'kubernetes.io',
    'git-scm.com',
    'about.gitlab.com',
    'www.python.org',
    'site.mockito.org',
    'jmockit.github.io',
    'easymock.org',
    'schema.org',
    'www.w3.org',
    'www.sitemaps.org',
]);

const SAFE_HYPHEN_CODES = new Set([
    'UTF-8',
    'WCAG-2',
    'ISO-8601',
    'SHA-256',
    'AES-256',
    'X-UA',
    'CI-CD',
    'HTTP-2',
]);

const APPROVED_FONT_RANGES = new Set(FONT_SUBSETS.map(({ range }) => range));
const FONT_LICENSE_HOSTS = new Set(['scripts.sil.org']);

const SECRET_AND_TOPOLOGY_RULES = [
    {
        name: 'private-ip',
        regex: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.0\.0\.1)\b/g,
    },
    {
        name: 'internal-hostname',
        regex: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:local|internal|corp|lan|intranet|cluster\.local|svc\.cluster)\b/gi,
    },
    {
        name: 'credential-or-connection-string',
        regex: /(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|jdbc:[a-z0-9]+:\/\/|amqp:\/\/|postgres(?:ql)?:\/\/|mongodb(?:\+srv)?:\/\/)/g,
    },
    {
        name: 'phone-number',
        regex: /\+\d[\d\s().-]{7,16}\d/g,
    },
];

const TEXT_EXTENSIONS = new Set(['.html', '.svg', '.json', '.js', '.css', '.md', '.txt', '.xml']);
const PROVENANCE_ORIGINS = new Map([
    ['independent-personal', 'personal'],
    ['authorised-open-source', 'open-source'],
    ['independent-educational', 'educational-example'],
]);
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRIVATE_PATH = /(?:^|\/)(?:\.private|private|applications?|application-packages)(?:\/|$)|(?:^|\/)(?:resume|cover-letter|interview-preparation|evidence-report|match-report|application-manifest)\.[\w-]+$/i;
const ROOT_PUBLIC_RESUMES = ['resume.md', 'resume.txt'];
const MAX_FILE_SIZE = 32 * 1024 * 1024;
const UTF8 = new TextDecoder('utf8', { fatal: true });

class ConfidentialityCheckError extends Error {
    constructor(counts) {
        const issues = [...counts]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([code, count]) => Object.freeze({ code, count }));
        super(`Confidentiality verification failed (${issues.map(({ code, count }) => `${code}: ${count}`).join(', ')}).`);
        this.name = 'ConfidentialityCheckError';
        this.issues = Object.freeze(issues);
    }
}

function readOptionalDenylist(filename) {
    try {
        return UTF8.decode(fs.readFileSync(filename));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return '';
    }
}

function parseEnvironmentDenylist(raw) {
    if (!raw.startsWith('base64:')) return raw;
    const encoded = raw.slice(7).trim();
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
        throw new Error('Invalid private denylist configuration');
    }
    return UTF8.decode(Buffer.from(encoded, 'base64'));
}

function isInside(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function loadPrivateDenylist({ artifactRoot, denylistPath, envDenylist }) {
    const realRoot = fs.realpathSync(artifactRoot);
    const paths = denylistPath ? [denylistPath] : [
        path.join(ROOT_DIR, '.private', 'confidential-denylist.txt'),
        path.join(ROOT_DIR, '.confidential-denylist'),
    ];
    const fixedLists = paths.map((filename) => {
        if (isInside(artifactRoot, path.resolve(filename))) throw new Error('Unsafe private denylist path');
        if (fs.existsSync(filename) && isInside(realRoot, fs.realpathSync(filename))) {
            throw new Error('Unsafe private denylist path');
        }
        return denylistPath ? UTF8.decode(fs.readFileSync(filename)) : readOptionalDenylist(filename);
    });
    const terms = [
        ...parseEnvironmentDenylist(envDenylist).split(/[\n,]/),
        ...fixedLists.flatMap((text) => text.split(/\r?\n/)),
    ];
    return [...new Set(terms.map((term) => term.trim().normalize('NFKC').toLowerCase())
        .filter((term) => term && !term.startsWith('#')))];
}

const NAMED_ENTITIES = {
    amp: '&', quot: '"', apos: "'", colon: ':', sol: '/', percnt: '%', tab: '\t', newline: '\n',
};

function decodeEntities(text) {
    return text
        .replace(/&#(?:x([a-f0-9]+)|(\d+));?/gi, (match, hex, decimal) => {
            const code = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal, 10);
            return code <= 0x10ffff ? String.fromCodePoint(code) : match;
        })
        .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function decodePercentEscapes(text) {
    return text.replace(/(?:%[a-f0-9]{2})+/gi, (part) => {
        try {
            return decodeURIComponent(part);
        } catch {
            return part;
        }
    });
}

function textForms(text) {
    const plain = text.normalize('NFKC');
    let decoded = plain;
    for (let pass = 0; pass < 2; pass++) {
        decoded = decodePercentEscapes(decodeEntities(decoded)
            .replace(/\\u([a-f0-9]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
            .replaceAll('\\/', '/'));
    }
    return new Set([plain, decoded.normalize('NFKC')]);
}

function approvedWebUrl(raw, extraHosts) {
    try {
        const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
        return ['https:', 'http:'].includes(url.protocol) && (ALLOWED_PUBLIC_HOSTS.has(url.hostname) || extraHosts?.has(url.hostname))
            && !url.username && !url.password && !url.port;
    } catch {
        return false;
    }
}

function scanText(text, policy, record) {
    const detected = new Set();
    for (const form of textForms(text)) {
        const phoneText = policy.fontStylesheet
            ? form.replace(/unicode-range:\s*([U+0-9A-F,-]+);/gim,
                (declaration, range) => APPROVED_FONT_RANGES.has(range) ? '' : declaration)
            : form;
        for (const { name, regex } of SECRET_AND_TOPOLOGY_RULES) {
            if ((name === 'phone-number' ? phoneText : form).match(regex)) detected.add(name);
        }
        for (const [code] of form.matchAll(/\b[A-Z]{2,8}-\d{2,6}\b/g)) {
            if (!SAFE_HYPHEN_CODES.has(code)) detected.add('ticket-like-identifier');
        }
        const webUrls = form.matchAll(/https?:\/\/[^\s"'<>\\()[\]{}]+|(?<=["'(=:\s])\/\/[a-z\d.-]+[^\s"'<>\\()[\]{}]*/gi);
        for (const [url] of webUrls) {
            if (!approvedWebUrl(url, policy.extraHosts)) detected.add('unapproved-host');
        }
        if (/\b(?:file|ftp|smb|ssh|ldap|gopher|ws|wss):\/\//i.test(form)) {
            detected.add('unapproved-url-scheme');
        }
        if (/\b(?:javascript|data|blob):(?=[^\s"'<>])/i.test(form)) {
            detected.add('unapproved-url-scheme');
        }
        for (const [address] of form.matchAll(/\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi)) {
            if (!policy.publicEmails.has(address.toLowerCase())) detected.add('unapproved-email');
        }
        const lower = form.toLowerCase();
        if (policy.terms.some((term) => lower.includes(term))) detected.add('denylist-match');
    }
    for (const code of detected) record(code);
}

function validSourceUrl(raw) {
    if (typeof raw !== 'string' || !approvedWebUrl(raw)) return false;
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'github.com'
        && /^\/[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\/|$)/i.test(url.pathname);
}

function validProvenance(entry) {
    const provenance = entry?.provenance;
    return Boolean(provenance && PROVENANCE_ORIGINS.has(provenance.kind)
        && PROVENANCE_ORIGINS.get(provenance.kind) === entry.origin
        && typeof provenance.summary === 'string' && provenance.summary.trim()
        && (provenance.kind === 'authorised-open-source'
            ? validSourceUrl(provenance.sourceUrl)
            : provenance.sourceUrl === undefined));
}

function validateArchitecture(data, policy, record) {
    const { architectureDiagrams, caseStudies } = data;
    const diagrams = new Map();
    const cases = new Set();
    if (!Array.isArray(architectureDiagrams) || !Array.isArray(caseStudies)) {
        record('invalid-provenance');
        return;
    }
    for (const diagram of architectureDiagrams) {
        if (!validProvenance(diagram) || !SAFE_SLUG.test(diagram?.slug ?? '')
            || typeof diagram.originLabel !== 'string' || !diagram.originLabel.trim() || diagrams.has(diagram.slug)) {
            record('invalid-provenance');
        } else {
            diagrams.set(diagram.slug, diagram.provenance);
        }
        scanText(JSON.stringify(diagram), policy, record);
    }
    for (const item of caseStudies) {
        if (!validProvenance(item) || !SAFE_SLUG.test(item?.id ?? '') || item.scopeType !== 'personal' || cases.has(item.id)) {
            record('invalid-provenance');
        } else if (item.diagramSlug !== undefined) {
            const source = diagrams.get(item.diagramSlug);
            if (!source || source.kind !== item.provenance.kind || source.sourceUrl !== item.provenance.sourceUrl) {
                record('invalid-provenance');
            }
        }
        cases.add(item?.id);
        scanText(JSON.stringify(item), policy, record);
    }
}

function isSafeManifestPath(value) {
    return typeof value === 'string' && (value === '.nojekyll'
        || /^[a-z0-9_-]+(?:[./][a-z0-9_-]+)*$/i.test(value));
}

function isPrivateArtifact(file, publicResumes) {
    return PRIVATE_PATH.test(file) && !publicResumes.has(file);
}

function validateManifest(manifest, publicResumes, record) {
    const paths = new Set();
    if (!Array.isArray(manifest) || manifest.length === 0) {
        record('invalid-manifest');
        return paths;
    }
    for (const item of manifest) {
        if (!isSafeManifestPath(item) || paths.has(item) || isPrivateArtifact(item, publicResumes)) {
            record('invalid-manifest');
        } else {
            paths.add(item);
        }
    }
    return paths;
}

function inspectFile(filename, relative, policy, record, counts) {
    const extension = path.extname(relative).toLowerCase();
    try {
        const info = fs.lstatSync(filename);
        if (!info.isFile()) {
            record('unsafe-entry');
            return;
        }
        const { size } = info;
        if (size > MAX_FILE_SIZE) {
            record('unsupported-artifact');
            return;
        }
        if (extension === '.pdf') {
            counts.pdfs++;
            const pdf = inspectPdf(filename);
            if (!pdf.validText) record('invalid-pdf-text');
            if (pdf.activeContent) record('unsafe-pdf-content');
            scanText(pdf.publicText, policy, record);
            if (pdf.links.some((url) => !(approvedWebUrl(url)
                || (url.toLowerCase().startsWith('mailto:') && policy.publicEmails.has(url.slice(7).toLowerCase()))))) {
                record('unapproved-pdf-link');
            }
            return;
        }
        const bytes = fs.readFileSync(filename);
        if (TEXT_EXTENSIONS.has(extension)) {
            const text = UTF8.decode(bytes);
            if (policy.publicResumes.has(relative) && policy.publicResumes.get(relative) !== text) {
                record('public-resume-mismatch');
            }
            if (extension === '.svg' && /<metadata\b|<!--|<!DOCTYPE\b|<!ENTITY\b/i.test(text)) record('image-metadata');
            scanText(text, relative === 'assets/fonts/INTER-LICENSE.txt'
                ? { ...policy, extraHosts: FONT_LICENSE_HOSTS }
                : { ...policy, fontStylesheet: relative === 'assets/css/style.css' }, record);
        } else if (Object.hasOwn(imageChecks, extension)) {
            if (!imageChecks[extension](bytes)) record('image-metadata');
        } else if (extension === '.woff2') {
            if (!isCleanFont(bytes)) record('font-metadata');
        } else if (path.basename(filename) !== '.nojekyll' || size !== 0) {
            record('unsupported-artifact');
        }
    } catch {
        record(extension === '.pdf' ? 'pdf-inspection-error' : 'artifact-inspection-error');
    }
}

function inspectArtifact({ artifactRoot, expected, policy, record }) {
    const existing = new Set();
    const counts = { files: 0, pdfs: 0 };
    const directories = new Set(['.']);
    for (const file of expected) {
        let directory = path.posix.dirname(file);
        while (!directories.has(directory)) {
            directories.add(directory);
            directory = path.posix.dirname(directory);
        }
    }

    function visit(relative = '.') {
        const directory = path.join(artifactRoot, relative);
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const name = path.posix.join(relative, entry.name);
            scanText(name, policy, record);
            if (isPrivateArtifact(name, policy.publicResumes)) record('private-application');
            if (entry.isDirectory()) {
                if (!directories.has(name)) record('unexpected-artifact');
                visit(name);
            } else if (!entry.isFile() || entry.isSymbolicLink()) {
                record('unsafe-entry');
            } else {
                counts.files++;
                existing.add(name);
                if (!expected.has(name)) record('unexpected-artifact');
                inspectFile(path.join(artifactRoot, name), name, policy, record, counts);
            }
        }
    }

    try {
        if (!fs.lstatSync(artifactRoot).isDirectory()) {
            record('unsafe-entry');
            return counts;
        }
        visit();
    } catch {
        record('artifact-inspection-error');
        return counts;
    }
    for (const file of expected) {
        if (!existing.has(file)) record('missing-artifact');
    }
    return counts;
}

function runConfidentialityCheck(options = {}) {
    const issues = new Map();
    const record = (code) => issues.set(code, (issues.get(code) ?? 0) + 1);
    let counts;
    try {
        const artifactRoot = path.resolve(options.artifactRoot ?? process.env.PUBLIC_ARTIFACT_DIR ?? path.join(ROOT_DIR, '_site'));
        const cvData = options.cvData ?? loadCvData();
        const manifest = options.manifest ?? require('./lib/public-artifact').publicFiles(cvData);
        const publicResumes = new Map();
        if (cvData.publicProfile && Array.isArray(manifest) && ROOT_PUBLIC_RESUMES.some((file) => manifest.includes(file))) {
            const { createPublicProfile } = require('./lib/public-profile');
            const { renderResume } = require('./build-profile');
            const profile = createPublicProfile(cvData);
            for (const file of ROOT_PUBLIC_RESUMES) publicResumes.set(file, renderResume(profile, file.endsWith('.md')));
        }
        const policy = {
            publicResumes,
            terms: loadPrivateDenylist({
                artifactRoot,
                denylistPath: options.denylistPath ?? process.env.CONFIDENTIAL_DENYLIST_FILE,
                envDenylist: options.envDenylist ?? process.env.CONFIDENTIAL_DENYLIST ?? '',
            }),
            publicEmails: new Set([cvData.profile?.contact?.email?.toLowerCase()].filter(Boolean)),
        };
        if (cvData.profile?.availability?.showOpenToWork) record('public-availability');
        validateArchitecture(cvData, policy, record);
        const expected = validateManifest(manifest, publicResumes, record);
        counts = inspectArtifact({ artifactRoot, expected, policy, record });
    } catch {
        record('configuration-or-inspection-error');
    }
    if (issues.size) throw new ConfidentialityCheckError(issues);
    return counts;
}

function parseArgs(args) {
    const options = {};
    const names = new Map([['--artifact-root', 'artifactRoot'], ['--denylist', 'denylistPath']]);
    for (let index = 0; index < args.length; index += 2) {
        const option = names.get(args[index]);
        const value = args[index + 1];
        if (!option || !value || value.startsWith('--') || Object.hasOwn(options, option)) {
            throw new ConfidentialityCheckError(new Map([['invalid-arguments', 1]]));
        }
        options[option] = value;
    }
    return options;
}

if (require.main === module) {
    try {
        const { files, pdfs } = runConfidentialityCheck(parseArgs(process.argv.slice(2)));
        console.log(`Confidentiality verification passed for ${files} public files, including ${pdfs} PDFs.`);
    } catch (error) {
        console.error(error instanceof ConfidentialityCheckError ? error.message : 'Confidentiality verification failed.');
        process.exitCode = 1;
    }
}

module.exports = { runConfidentialityCheck, ConfidentialityCheckError };
