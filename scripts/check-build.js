const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-build-'));
const techPages = fs.readdirSync(path.join(root, 'tech'))
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join('tech', file));
const pages = ['index.html', 'whatsapp.html', ...techPages];

try {
    const result = spawnSync(process.execPath, [require.resolve('gulp-cli/bin/gulp.js'), 'build'], {
        cwd: root,
        env: { ...process.env, CI: '1', CV_BUILD_DIR: temporary },
        stdio: 'inherit'
    });
    assert.equal(result.status, 0, 'The JavaScript and Sass tasks must finish successfully');
    for (const output of ['js/main.js', 'css/style.css']) {
        assert.ok(fs.statSync(path.join(temporary, output)).size > 0, `${output} must contain compiled assets`);
    }
    for (const page of pages) {
        const pageDirectory = path.dirname(path.join(root, page));
        const contents = fs.readFileSync(path.join(root, page), 'utf8');
        for (const [, reference] of contents.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
            const local = decodeURIComponent(reference.split(/[?#]/)[0]);
            const target = local.startsWith('/') ? path.join(root, local) : path.resolve(pageDirectory, local);
            assert.ok(fs.existsSync(target), `${page} references missing local asset ${reference}`);
        }
    }
    console.log(`Compiled JavaScript and Sass; ${pages.length} HTML pages reference only existing local assets.`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
