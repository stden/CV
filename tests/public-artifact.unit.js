const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { publicFiles, validatePublicLinks } = require('../scripts/lib/public-artifact');

test('the manifest includes declared public pages and excludes private, source and arbitrary paths', () => {
    const files = publicFiles({
        profile: { photo: 'assets/images/photo.jpg' },
        variants: [{ slug: 'general', pdfFilename: 'Person-General.pdf' }],
        technologies: [{ slug: 'java', logo: true }, { slug: 'sql', logo: false }],
        architectureDiagrams: [{ slug: 'independent-example' }],
        githubProjects: [{ slug: 'example', previewImage: 'assets/images/projects/example-preview.webp' }],
    });
    for (const name of ['cv/general.html', 'assets/pdf/Person-General.pdf', 'assets/images/tech/java.svg', 'tech/sql.html', 'assets/images/projects/independent-example.svg', 'assets/images/projects/example-preview.webp', 'experience/index.html', 'skills/index.html', 'projects/index.html', 'architecture/index.html']) {
        assert.ok(files.includes(name));
    }
    assert.ok(files.every((name) => !name.startsWith('applications/') && !name.startsWith('data/') && !name.startsWith('scripts/')));
    assert.throws(() => publicFiles({
        profile: { photo: '../../fictional-private.jpg' }, variants: [], technologies: [], architectureDiagrams: [],
    }), (error) => error.message === 'PUBLIC_MANIFEST_INVALID');
});

test('staged URLs resolve below the Pages base and errors disclose no reference', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-link-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'cv'));
    fs.writeFileSync(path.join(root, 'index.html'), '<a href="cv/general.html#education">CV</a>');
    fs.writeFileSync(path.join(root, 'cv/general.html'), '<main id="education"><a href="../#overview">Home</a></main>');
    assert.throws(() => validatePublicLinks(root, 'https://example.invalid/CV/', ['index.html', 'cv/general.html']),
        (error) => error.message === 'PUBLIC_LINK_TARGET_MISSING');
    fs.writeFileSync(path.join(root, 'index.html'), '<main id="overview"><a href="cv/general.html#education">CV</a></main>');
    assert.doesNotThrow(() => validatePublicLinks(root, 'https://example.invalid/CV/', ['index.html', 'cv/general.html']));
    fs.writeFileSync(path.join(root, 'index.html'), '<img src="/fictional-private-identifier.png">');
    assert.throws(() => validatePublicLinks(root, 'https://example.invalid/CV/', ['index.html']),
        (error) => error.message === 'PUBLIC_LINK_OUTSIDE_BASE');
});
