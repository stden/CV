const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { runConfidentialityCheck } = require('../scripts/check-confidentiality');

const syntheticCv = {
    profile: { contact: { email: 'example@example.org' } },
    caseStudies: [],
    architectureDiagrams: [],
};

function fixture(t, files) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-confidentiality-'));
    const artifactRoot = path.join(directory, 'artifact');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(artifactRoot);
    for (const [name, contents] of Object.entries(files)) {
        const target = path.join(artifactRoot, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    }
    return { directory, artifactRoot, manifest: Object.keys(files), cvData: syntheticCv, envDenylist: '' };
}

function expectViolation(options, code, hidden = []) {
    assert.throws(() => runConfidentialityCheck(options), (error) => {
        assert.equal(error.name, 'ConfidentialityCheckError');
        assert.ok(error.issues.some((issue) => issue.code === code));
        for (const value of hidden) {
            assert.ok(!JSON.stringify(error).includes(value));
            assert.ok(!error.message.includes(value));
        }
        return true;
    });
}

// Uncompressed so each fixture is human-readable and reproducible without a browser.
function pdf({ text = 'Synthetic resume text', title = 'Synthetic resume', url = 'https://github.com/example/example' } = {}) {
    const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET\n`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [7 0 R] >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
        `<< /Title (${title}) >>`,
        `<< /Type /Annot /Subtype /Link /Rect [20 20 100 40] /A << /S /URI /URI (${url}) >> >>`,
    ];
    let file = '%PDF-1.4\n';
    const offsets = objects.map((object, index) => {
        const position = Buffer.byteLength(file);
        file += `${index + 1} 0 obj\n${object}\nendobj\n`;
        return position;
    });
    const xrefOffset = Buffer.byteLength(file);
    file += `xref\n0 8\n0000000000 65535 f \n${offsets.map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}`;
    return `${file}trailer\n<< /Root 1 0 R /Info 6 0 R /Size 8 >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
}

test('an approved synthetic artifact is scanned with no findings', (t) => {
    const options = fixture(t, {
        '.nojekyll': '',
        'index.html': '<a href="https://github.com/example/example">Public project</a>',
        'assets/cv.pdf': pdf(),
    });
    const result = runConfidentialityCheck(options);
    assert.equal(result.files, 3);
    assert.equal(result.pdfs, 1);
});

test('external hosts, including entity-encoded URLs, are rejected without disclosure', (t) => {
    const host = 'unapproved-synthetic.invalid';
    const options = fixture(t, { 'index.html': `<a href="h&#116;tps://${host}/test">Project</a>` });
    expectViolation(options, 'unapproved-host', [host]);
});

test('every requested public text type is checked with the private denylist', (t) => {
    const term = 'Example Fictional Marker';
    const options = fixture(t, Object.fromEntries(['html', 'svg', 'json', 'js', 'css', 'md', 'xml', 'txt']
        .map((ext) => [`synthetic.${ext}`, 'Example%20Fictional%20Marker'])));
    options.denylistPath = path.join(options.directory, 'private-data.txt');
    fs.writeFileSync(options.denylistPath, `# Synthetic test only\n${term}\n`);
    assert.throws(() => runConfidentialityCheck(options), (error) => {
        assert.deepEqual(error.issues.find(({ code }) => code === 'denylist-match'), { code: 'denylist-match', count: 8 });
        assert.ok(!error.message.includes(term));
        return true;
    });
});

test('a private denylist cannot be read from inside the publication directory', (t) => {
    const options = fixture(t, {
        'index.html': 'Public',
        'synthetic-denylist.txt': 'fictional secret term',
    });
    options.denylistPath = path.join(options.artifactRoot, 'synthetic-denylist.txt');
    expectViolation(options, 'configuration-or-inspection-error', [options.denylistPath, 'fictional secret term']);
});

test('filenames are checked and unexpected private artifacts are rejected', (t) => {
    const name = 'private/fictional-application/resume.pdf';
    const options = fixture(t, { 'index.html': 'Public', [name]: pdf() });
    options.manifest = ['index.html'];
    options.envDenylist = 'fictional-application';
    expectViolation(options, 'private-application', [name, options.envDenylist]);
    expectViolation(options, 'denylist-match', [name, options.envDenylist]);
    expectViolation(options, 'unexpected-artifact', [name]);
});

test('symlinks and missing manifest files are caught without dereferencing', (t) => {
    const options = fixture(t, { 'index.html': 'Public' });
    fs.symlinkSync(options.directory, path.join(options.artifactRoot, 'fixture-link'));
    options.manifest.push('required.html');
    expectViolation(options, 'unsafe-entry', ['fixture-link']);
    expectViolation(options, 'missing-artifact', ['required.html']);
});

for (const [source, content, issue] of [
    ['text', { text: 'SYNTHETIC-TEXT-MARKER' }, 'denylist-match'],
    ['metadata', { title: 'SYNTHETIC-TITLE-MARKER' }, 'denylist-match'],
    ['link target', { url: 'https://fictional-private.invalid/document' }, 'unapproved-host'],
    ['non-web link target', { url: 'file:///fictional/private/document' }, 'unapproved-pdf-link'],
]) {
    test(`PDF ${source} is inspected and diagnostics are sanitised`, (t) => {
        const options = fixture(t, { 'assets/sample.pdf': pdf(content) });
        options.envDenylist = 'SYNTHETIC-TEXT-MARKER,SYNTHETIC-TITLE-MARKER';
        expectViolation(options, issue, [...Object.values(content), 'assets/sample.pdf']);
    });
}

test('a clean PNG is accepted and the same PNG with a text chunk is rejected', (t) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5+XIMAAAAASUVORK5CYII=', 'base64');
    const options = fixture(t, { 'assets/sample.png': png });
    assert.equal(runConfidentialityCheck(options).files, 1);
    const metadata = Buffer.from('Description\0Fictional metadata', 'utf8');
    const chunk = Buffer.alloc(metadata.length + 12);
    chunk.writeUInt32BE(metadata.length);
    chunk.write('tEXt', 4);
    metadata.copy(chunk, 8);
    fs.writeFileSync(path.join(options.artifactRoot, 'assets/sample.png'), Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]));
    expectViolation(options, 'image-metadata', ['Fictional metadata']);
});

test('unsupported or unsafe image metadata cannot be published', (t) => {
    const options = fixture(t, {
        'assets/sample.svg': '<svg xmlns="http://www.w3.org/2000/svg"><metadata>Fictional data</metadata></svg>',
        'assets/sample.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, 0xff, 0xd9]),
        'assets/sample.webp': Buffer.from('RIFF\x0c\x00\x00\x00WEBPEXIF\x00\x00\x00\x00', 'latin1'),
    });
    assert.throws(() => runConfidentialityCheck(options), (error) => {
        assert.deepEqual(error.issues.find(({ code }) => code === 'image-metadata'), { code: 'image-metadata', count: 3 });
        assert.ok(!error.message.includes('Fictional data'));
        return true;
    });
});

test('architecture requires explicit matching independent provenance', (t) => {
    const prototype = { kind: 'independent-personal', summary: 'Created as an independent fictional demonstration.' };
    const example = { id: 'fictional-example', diagramSlug: 'fictional-example', origin: 'personal', scopeType: 'personal', provenance: prototype };
    const diagram = { slug: 'fictional-example', origin: 'personal', originLabel: 'Personal project', provenance: prototype };
    const options = fixture(t, {
        'assets/images/projects/fictional-example.svg': '<svg xmlns="http://www.w3.org/2000/svg"><title>Fictional diagram</title></svg>',
    });
    options.cvData = { ...syntheticCv, caseStudies: [example], architectureDiagrams: [diagram] };
    assert.equal(runConfidentialityCheck(options).files, 1);
    options.cvData = { ...options.cvData, caseStudies: [{ ...example, provenance: { ...prototype, kind: 'employer-private' } }] };
    expectViolation(options, 'invalid-provenance', ['fictional-example', 'employer-private']);
    options.cvData = { ...options.cvData, caseStudies: [{ ...example, origin: 'open-source', provenance: { ...prototype, kind: 'authorised-open-source' } }] };
    expectViolation(options, 'invalid-provenance', ['fictional-example']);
});

test('invalid CLI arguments are rejected without printing user-supplied values', () => {
    const sentinel = 'fictional-secret-argument';
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/check-confidentiality.js'), '--unsupported', sentinel], {
        encoding: 'utf8',
        env: { ...process.env, CONFIDENTIAL_DENYLIST: '' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid-arguments/);
    assert.ok(!result.stderr.includes(sentinel));
    assert.equal(result.stdout, '');
});
