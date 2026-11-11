const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-build-'));

try {
    const result = spawnSync(process.execPath, [require.resolve('gulp-cli/bin/gulp.js'), 'build'], {
        cwd: root,
        env: { ...process.env, CI: '1', CV_BUILD_DIR: temporary },
        stdio: 'inherit'
    });
    assert.equal(result.status, 0, 'The JavaScript, Sass and image tasks must finish successfully');
    for (const output of ['js/main.js', 'css/style.css']) {
        assert.ok(fs.statSync(path.join(temporary, output)).size > 0, `${output} must contain compiled assets`);
    }
    for (const html of ['index.html', 'whatsapp.html']) {
        const contents = fs.readFileSync(path.join(root, html), 'utf8');
        for (const [, reference] of contents.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
            const relative = decodeURIComponent(reference.split(/[?#]/)[0]).replace(/^\//, '');
            assert.ok(fs.existsSync(path.join(root, relative)), `${html} references missing local asset ${reference}`);
        }
    }
    console.log('Compiled JavaScript and Sass; all published HTML assets exist.');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
