const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ROOT_DIR } = require('./lib/utils');
const { startServer } = require('./serve-subpath');
const { resolveChromeExecutable } = require('./lib/browser');

const OUT_DIR = path.join(ROOT_DIR, '.lighthouse');

function runCommandAsync(cmd, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: ROOT_DIR,
            env,
            stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} exited with code ${code}`));
        });
    });
}

async function runPreset(url, preset, chromePath) {
    const outFile = path.join(OUT_DIR, `lighthouse-${preset}.json`);
    const args = [
        '--yes',
        'lighthouse',
        url,
        '--output=json',
        `--output-path=${outFile}`,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
        '--quiet',
    ];
    if (preset === 'desktop') {
        args.push('--preset=desktop');
    }

    await runCommandAsync('npx', args, {
        ...process.env,
        ...(chromePath ? { CHROME_PATH: chromePath } : {}),
    });

    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const cats = report.categories;
    const audits = report.audits;
    return {
        preset,
        performance: Math.round(cats.performance.score * 100),
        accessibility: Math.round(cats.accessibility.score * 100),
        bestPractices: Math.round(cats['best-practices'].score * 100),
        seo: Math.round(cats.seo.score * 100),
        lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
        cls: Number((audits['cumulative-layout-shift']?.numericValue || 0).toFixed(4)),
    };
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const chromePath = resolveChromeExecutable();
    const server = await startServer(4174);
    try {
        const url = 'http://127.0.0.1:4174/CV/';
        const mobile = await runPreset(url, 'mobile', chromePath);
        const desktop = await runPreset(url, 'desktop', chromePath);
        console.log('=== LIGHTHOUSE RESULTS ===');
        console.log(JSON.stringify({ mobile, desktop }, null, 2));
        for (const r of [mobile, desktop]) {
            if (r.performance < 95 || r.accessibility < 95 || r.bestPractices < 95 || r.seo < 95 || r.lcpMs >= 2500 || r.cls >= 0.1) {
                throw new Error(`Lighthouse threshold not met for ${r.preset}: ${JSON.stringify(r)}`);
            }
        }
    } finally {
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
