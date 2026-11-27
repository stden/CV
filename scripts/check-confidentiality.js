const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ROOT_DIR, loadCvData } = require('./lib/utils');

const ALLOWED_ORIGINS = new Set(['personal', 'open-source', 'educational-example']);

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

function loadPrivateDenylist() {
    const terms = [];
    const envRaw = process.env.CONFIDENTIAL_DENYLIST || '';
    if (envRaw.trim()) {
        const decoded = envRaw.startsWith('base64:')
            ? Buffer.from(envRaw.slice(7), 'base64').toString('utf8')
            : envRaw;
        for (const t of decoded.split(/[,\n]/)) {
            if (t.trim()) terms.push(t.trim());
        }
    }
    const localFile = path.join(ROOT_DIR, '.confidential-denylist');
    if (fs.existsSync(localFile)) {
        for (const line of fs.readFileSync(localFile, 'utf8').split(/\r?\n/)) {
            const clean = line.trim();
            if (clean && !clean.startsWith('#')) terms.push(clean);
        }
    }
    return terms;
}

function collectPublicTextFiles() {
    const files = [];
    const topFiles = ['index.html', 'robots.txt', 'sitemap.xml', 'README.md', 'CONTENT_REVIEW.md', 'data/cv.json'];
    for (const rel of topFiles) {
        const p = path.join(ROOT_DIR, rel);
        if (fs.existsSync(p)) files.push(rel);
    }
    for (const dir of ['cv', 'tech', 'assets/css', 'assets/js', 'assets/images']) {
        const absDir = path.join(ROOT_DIR, dir);
        if (!fs.existsSync(absDir)) continue;
        const walk = (cur) => {
            for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
                const abs = path.join(cur, entry.name);
                if (entry.isDirectory()) {
                    walk(abs);
                } else if (/\.(html|css|js|svg|json|md|txt|xml)$/i.test(entry.name)) {
                    files.push(path.relative(ROOT_DIR, abs));
                }
            }
        };
        walk(absDir);
    }
    return files.sort();
}

function scanText(label, text, privateTerms, failures) {
    for (const rule of SECRET_AND_TOPOLOGY_RULES) {
        const matches = text.match(rule.regex);
        if (matches) {
            failures.push(`${label}: matched prohibited ${rule.name} pattern`);
        }
    }

    // Check ticket-style identifiers like ABC-1234
    for (const m of text.matchAll(/\b([A-Z]{2,8}-\d{2,6})\b/g)) {
        if (!SAFE_HYPHEN_CODES.has(m[1])) {
            failures.push(`${label}: matched ticket-like identifier pattern`);
        }
    }

    // Strict URL hostname allowlist
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)(?::\d+)?/gi)) {
        const host = m[1].toLowerCase();
        if (!ALLOWED_PUBLIC_HOSTS.has(host)) {
            failures.push(`${label}: unapproved external host (${host})`);
        }
    }

    // Private denylist terms (never echoed in output)
    const lower = text.toLowerCase();
    for (let i = 0; i < privateTerms.length; i++) {
        if (lower.includes(privateTerms[i].toLowerCase())) {
            failures.push(`${label}: matched private denylist rule #${i + 1}`);
        }
    }
}

function checkJpegHasNoExif(relPath, failures) {
    const abs = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(abs)) {
        failures.push(`Missing image: ${relPath}`);
        return;
    }
    const data = fs.readFileSync(abs);
    if (data[0] !== 0xff || data[1] !== 0xd8) {
        failures.push(`${relPath}: not a valid JPEG`);
        return;
    }
    let i = 2;
    while (i < data.length) {
        while (i < data.length && data[i] === 0xff) i += 1;
        const marker = data[i];
        i += 1;
        if (marker === 0xda || marker === 0xd9) break;
        const segLen = data.readUInt16BE(i);
        if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
            failures.push(`${relPath}: contains JPEG metadata/comment marker 0x${marker.toString(16)}`);
        }
        i += segLen;
    }
}

function runConfidentialityCheck() {
    const failures = [];
    const data = loadCvData();
    const privateTerms = loadPrivateDenylist();

    if (data.profile.availability?.showOpenToWork) {
        failures.push('data/cv.json: availability.showOpenToWork must be false by default');
    }

    for (const cs of data.caseStudies) {
        if (!ALLOWED_ORIGINS.has(cs.origin) || cs.scopeType !== 'personal') {
            failures.push(`data/cv.json: case study "${cs.id}" must be independent/open-source`);
        }
    }

    for (const diagram of data.architectureDiagrams) {
        if (!ALLOWED_ORIGINS.has(diagram.origin) || !diagram.originLabel) {
            failures.push(`data/cv.json: diagram "${diagram.slug}" must declare a non-employer origin and originLabel`);
        }
    }

    for (const rel of collectPublicTextFiles()) {
        const text = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
        if (rel.endsWith('.svg')) {
            if (/<metadata\b/i.test(text) || /<!--/.test(text)) {
                failures.push(`${rel}: SVG must not contain <metadata> or comments`);
            }
        }
        scanText(rel, text, privateTerms, failures);
    }

    for (const variant of data.variants) {
        const pdfPath = path.join(ROOT_DIR, 'assets', 'pdf', variant.pdfFilename);
        if (fs.existsSync(pdfPath)) {
            const pdfText = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
            scanText(`assets/pdf/${variant.pdfFilename}`, pdfText, privateTerms, failures);
        }
    }

    checkJpegHasNoExif(data.profile.photo, failures);

    if (failures.length > 0) {
        throw new Error(`Confidentiality verification failed:\n - ${failures.join('\n - ')}`);
    }
    console.log('Confidentiality verification passed: 0 prohibited patterns, 0 unapproved hosts, 0 EXIF/SVG metadata leaks.');
}

if (require.main === module) {
    runConfidentialityCheck();
}

module.exports = { runConfidentialityCheck };
