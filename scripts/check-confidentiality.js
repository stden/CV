const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
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

const FORBIDDEN_DEPLOYMENT_SEGMENTS = [
    /(?:^|\/)applications(?:\/|$)/i,
    /(?:^|\/)vacancies(?:\/|$)/i,
    /(?:^|\/)\.confidential-denylist$/i,
    /(?:^|\/)CONTENT_REVIEW\.md$/i,
];

function loadPrivateDenylist(rootDir = ROOT_DIR) {
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
    const localFile = path.join(rootDir, '.confidential-denylist');
    if (fs.existsSync(localFile)) {
        for (const line of fs.readFileSync(localFile, 'utf8').split(/\r?\n/)) {
            const clean = line.trim();
            if (clean && !clean.startsWith('#')) terms.push(clean);
        }
    }
    return terms;
}

function walkFiles(baseDir, filterFn = () => true) {
    const results = [];
    if (!fs.existsSync(baseDir)) return results;
    const walk = (cur) => {
        for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
            const abs = path.join(cur, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            } else if (filterFn(abs, entry.name)) {
                results.push(abs);
            }
        }
    };
    walk(baseDir);
    return results.sort();
}

function collectPublicTextFiles(rootDir = ROOT_DIR) {
    const files = [];
    const topFiles = [
        'index.html',
        'robots.txt',
        'sitemap.xml',
        'README.md',
        'CONTENT_REVIEW.md',
        'data/cv.json',
        'data/repo-metadata.json',
    ];
    for (const rel of topFiles) {
        const p = path.join(rootDir, rel);
        if (fs.existsSync(p)) files.push(rel);
    }
    for (const dir of ['cv', 'tech', 'assets/css', 'assets/js', 'assets/images']) {
        const absDir = path.join(rootDir, dir);
        for (const abs of walkFiles(absDir, (_, name) => /\.(html|css|js|svg|json|md|txt|xml)$/i.test(name))) {
            files.push(path.relative(rootDir, abs).split(path.sep).join('/'));
        }
    }
    return files.sort();
}

function scanText(label, text, privateTerms, failures, { allowedHosts = ALLOWED_PUBLIC_HOSTS } = {}) {
    const str = String(text ?? '');
    for (const rule of SECRET_AND_TOPOLOGY_RULES) {
        if (rule.regex.test(str)) {
            failures.push(`${label}: matched prohibited ${rule.name} pattern`);
        }
        rule.regex.lastIndex = 0;
    }

    for (const m of str.matchAll(/\b([A-Z]{2,8}-\d{2,6})\b/g)) {
        if (!SAFE_HYPHEN_CODES.has(m[1])) {
            failures.push(`${label}: matched ticket-like identifier pattern`);
            break;
        }
    }

    let sawUnapprovedHost = false;
    for (const m of str.matchAll(/https?:\/\/([a-z0-9.-]+)(?::\d+)?/gi)) {
        const host = m[1].toLowerCase();
        if (!allowedHosts.has(host)) {
            sawUnapprovedHost = true;
            break;
        }
    }
    if (sawUnapprovedHost) {
        failures.push(`${label}: unapproved external host detected [redacted]`);
    }

    const lower = str.toLowerCase();
    for (let i = 0; i < privateTerms.length; i++) {
        if (lower.includes(privateTerms[i].toLowerCase())) {
            failures.push(`${label}: matched private denylist rule #${i + 1}`);
        }
    }
}

function checkFilename(relPath, privateTerms, failures, { strictDeployment = false } = {}) {
    const normalised = relPath.split(path.sep).join('/');
    if (strictDeployment) {
        for (const pattern of FORBIDDEN_DEPLOYMENT_SEGMENTS) {
            if (pattern.test(normalised)) {
                failures.push('deployment-artifact: forbidden non-public path detected [redacted]');
                return;
            }
        }
    }
    if (/(?:secret|credential|confidential|private|salary|passport|internal-only)/i.test(path.basename(normalised))) {
        failures.push('filename-check: potentially sensitive filename detected [redacted]');
    }
    scanText('filename-check', normalised, privateTerms, failures);
}

function checkJpegHasNoExif(absPath, label, failures) {
    if (!fs.existsSync(absPath)) {
        failures.push(`Missing image: ${label}`);
        return;
    }
    const data = fs.readFileSync(absPath);
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
        failures.push(`${label}: not a valid JPEG`);
        return;
    }
    let i = 2;
    while (i < data.length) {
        while (i < data.length && data[i] === 0xff) i += 1;
        if (i >= data.length) break;
        const marker = data[i];
        i += 1;
        if (marker === 0xda || marker === 0xd9) break;
        if (i + 2 > data.length) break;
        const segLen = data.readUInt16BE(i);
        if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
            failures.push(`${label}: contains JPEG metadata/comment marker 0x${marker.toString(16)}`);
        }
        i += segLen;
    }
}

function checkPngMetadata(absPath, label, privateTerms, failures) {
    if (!fs.existsSync(absPath)) {
        failures.push(`Missing image: ${label}`);
        return;
    }
    const data = fs.readFileSync(absPath);
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (data.length < 8 || !data.subarray(0, 8).equals(sig)) {
        failures.push(`${label}: not a valid PNG`);
        return;
    }
    let offset = 8;
    while (offset + 8 <= data.length) {
        const len = data.readUInt32BE(offset);
        const type = data.subarray(offset + 4, offset + 8).toString('ascii');
        const payloadStart = offset + 8;
        const payloadEnd = payloadStart + len;
        if (payloadEnd + 4 > data.length) break;
        if (type === 'tEXt' || type === 'iTXt') {
            const rawText = data.subarray(payloadStart, payloadEnd).toString('utf8').replace(/\0+/g, ' ');
            scanText(`${label} [png-${type}]`, rawText, privateTerms, failures);
        } else if (type === 'zTXt') {
            const chunk = data.subarray(payloadStart, payloadEnd);
            const nul = chunk.indexOf(0);
            if (nul >= 0 && nul + 2 < chunk.length) {
                const key = chunk.subarray(0, nul).toString('utf8');
                let value = '';
                try {
                    value = zlib.inflateSync(chunk.subarray(nul + 2)).toString('utf8');
                } catch {
                    value = '';
                }
                scanText(`${label} [png-zTXt]`, `${key} ${value}`, privateTerms, failures);
            }
        }
        offset = payloadEnd + 4;
        if (type === 'IEND') break;
    }
}

function checkPdfFile(absPath, label, privateTerms, failures, { allowedHosts = ALLOWED_PUBLIC_HOSTS } = {}) {
    if (!fs.existsSync(absPath)) return;
    let pdfText = '';
    let info = '';
    try {
        pdfText = execFileSync('pdftotext', [absPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        info = execFileSync('pdfinfo', [absPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
        failures.push(`${label}: unreadable or malformed PDF`);
        return;
    }
    scanText(label, pdfText, privateTerms, failures, { allowedHosts });
    const metaLines = info
        .split(/\r?\n/)
        .filter((line) => /^(Title|Author|Subject|Keywords|Creator|Producer):/i.test(line))
        .join('\n');
    scanText(`${label} [pdf-metadata]`, metaLines, privateTerms, failures, { allowedHosts });

    const rawPdf = fs.readFileSync(absPath).toString('latin1');
    for (const match of rawPdf.matchAll(/\/URI\s*\(([^)]+)\)/g)) {
        const uri = match[1].replace(/\\([()\\])/g, '$1').trim();
        if (/^mailto:/i.test(uri)) {
            scanText(`${label} [pdf-link]`, uri, privateTerms, failures, { allowedHosts });
            continue;
        }
        if (/^https?:\/\//i.test(uri)) {
            let host = '';
            try {
                host = new URL(uri).hostname.toLowerCase();
            } catch {
                failures.push(`${label}: malformed embedded PDF URI [redacted]`);
                continue;
            }
            if (!allowedHosts.has(host)) {
                failures.push(`${label}: unapproved embedded PDF URI host [redacted]`);
            }
            scanText(`${label} [pdf-link]`, uri, privateTerms, failures, { allowedHosts });
        }
    }
}

function checkProvenance(data, failures) {
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
        if (diagram.origin === 'educational-example' && !/unrelated to any employer/i.test(diagram.originLabel)) {
            failures.push(`data/cv.json: educational diagram "${diagram.slug}" must state it is unrelated to any employer system`);
        }
    }
}

function checkSiteBundle(siteDir, privateTerms, failures, { allowedHosts = ALLOWED_PUBLIC_HOSTS } = {}) {
    if (!fs.existsSync(siteDir)) {
        failures.push(`Missing site artifact directory: ${siteDir}`);
        return 0;
    }
    const allFiles = walkFiles(siteDir);
    for (const abs of allFiles) {
        const rel = path.relative(siteDir, abs).split(path.sep).join('/');
        checkFilename(rel, privateTerms, failures, { strictDeployment: true });
        if (/\.(html|css|js|svg|json|md|txt|xml)$/i.test(rel)) {
            const text = fs.readFileSync(abs, 'utf8');
            if (rel.endsWith('.svg') && (/<metadata\b/i.test(text) || /<!--/.test(text))) {
                failures.push(`${rel}: SVG must not contain <metadata> or comments`);
            }
            scanText(rel, text, privateTerms, failures, { allowedHosts });
        } else if (/\.pdf$/i.test(rel)) {
            checkPdfFile(abs, rel, privateTerms, failures, { allowedHosts });
        } else if (/\.(jpe?g)$/i.test(rel)) {
            checkJpegHasNoExif(abs, rel, failures);
        } else if (/\.png$/i.test(rel)) {
            checkPngMetadata(abs, rel, privateTerms, failures);
        }
    }
    return allFiles.length;
}

function runConfidentialityCheck({ siteDir = null, rootDir = ROOT_DIR } = {}) {
    const failures = [];
    const data = loadCvData();
    const privateTerms = loadPrivateDenylist(rootDir);

    checkProvenance(data, failures);

    try {
        const trackedApps = execFileSync('git', ['ls-files', 'applications'], {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (trackedApps) {
            failures.push('git: tracked private application files detected [redacted]');
        }
    } catch {
        // Ignore if run outside a git working tree.
    }

    if (siteDir) {
        const absSite = path.isAbsolute(siteDir) ? siteDir : path.resolve(rootDir, siteDir);
        const count = checkSiteBundle(absSite, privateTerms, failures);
        if (failures.length > 0) {
            throw new Error(`Confidentiality verification failed:\n - ${failures.join('\n - ')}`);
        }
        console.log(`Confidentiality verification passed on staged artifact (${count} files): 0 prohibited patterns, 0 unapproved hosts, 0 EXIF/SVG/PDF metadata leaks.`);
        return;
    }

    for (const rel of collectPublicTextFiles(rootDir)) {
        checkFilename(rel, privateTerms, failures);
        const text = fs.readFileSync(path.join(rootDir, rel), 'utf8');
        if (rel.endsWith('.svg') && (/<metadata\b/i.test(text) || /<!--/.test(text))) {
            failures.push(`${rel}: SVG must not contain <metadata> or comments`);
        }
        scanText(rel, text, privateTerms, failures);
    }

    const pdfSet = new Set(data.variants.map((v) => v.pdfFilename));
    const pdfDir = path.join(rootDir, 'assets', 'pdf');
    if (fs.existsSync(pdfDir)) {
        for (const absPdf of walkFiles(pdfDir, (_, name) => /\.pdf$/i.test(name))) {
            pdfSet.add(path.basename(absPdf));
        }
    }
    for (const pdfName of [...pdfSet].sort()) {
        const relPdf = `assets/pdf/${pdfName}`;
        checkFilename(relPdf, privateTerms, failures);
        checkPdfFile(path.join(rootDir, relPdf), relPdf, privateTerms, failures);
    }

    const imagesDir = path.join(rootDir, 'assets', 'images');
    for (const absImg of walkFiles(imagesDir, (_, name) => /\.(jpe?g|png)$/i.test(name))) {
        const relImg = path.relative(rootDir, absImg).split(path.sep).join('/');
        checkFilename(relImg, privateTerms, failures);
        if (/\.png$/i.test(relImg)) {
            checkPngMetadata(absImg, relImg, privateTerms, failures);
        } else {
            checkJpegHasNoExif(absImg, relImg, failures);
        }
    }
    checkJpegHasNoExif(path.join(rootDir, data.profile.photo), data.profile.photo, failures);

    if (failures.length > 0) {
        throw new Error(`Confidentiality verification failed:\n - ${failures.join('\n - ')}`);
    }
    console.log('Confidentiality verification passed: 0 prohibited patterns, 0 unapproved hosts, 0 EXIF/SVG/PDF metadata leaks.');
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const siteIdx = args.indexOf('--site-dir');
    const siteDir = siteIdx >= 0 ? args[siteIdx + 1] : null;
    if (siteIdx >= 0 && !siteDir) {
        console.error('Usage: node scripts/check-confidentiality.js [--site-dir <path>]');
        process.exit(1);
    }
    runConfidentialityCheck({ siteDir });
}

module.exports = {
    ALLOWED_ORIGINS,
    ALLOWED_PUBLIC_HOSTS,
    checkFilename,
    checkJpegHasNoExif,
    checkPdfFile,
    checkPngMetadata,
    checkProvenance,
    checkSiteBundle,
    loadPrivateDenylist,
    runConfidentialityCheck,
    scanText,
};
